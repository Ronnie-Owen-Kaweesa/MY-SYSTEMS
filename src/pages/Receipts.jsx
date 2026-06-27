import React, { useState, useEffect } from 'react';
import supabase from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Receipts() {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async (search = '', from = '', to = '') => {
    setLoading(true);
    let query = supabase
      .from('receipts')
      .select(`
        *,
        tab:tabs!inner (
          customer_name,
          total,
          status,
          opened_at,
          phone_number,
          cashier:users!tabs_cashier_id_fkey (full_name)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (search) {
      // Search by customer name or receipt number
      query = query.or(`tab.customer_name.ilike.%${search}%,receipt_number.ilike.%${search}%`);
    }
    if (from) {
      query = query.gte('created_at', `${from}T00:00:00`);
    }
    if (to) {
      query = query.lte('created_at', `${to}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Failed to load receipts');
      console.error(error);
    } else {
      setReceipts(data || []);
    }
    setLoading(false);
  };

  const handleSearch = () => {
    fetchReceipts(searchTerm, dateFrom, dateTo);
  };

  const handleReprint = (receipt) => {
    const receiptWindow = window.open('', '_blank');
    const date = new Date(receipt.created_at).toLocaleString('en-UG');
    const total = formatCurrency(receipt.tab?.total);
    const customer = receipt.tab?.customer_name || 'N/A';
    const cashier = receipt.tab?.cashier?.full_name || 'N/A';
    const phone = receipt.tab?.phone_number || '';

    const html = `
      <html>
        <head><title>Receipt ${receipt.receipt_number}</title>
        <style>
          body { font-family: monospace; width: 280px; margin: 0 auto; padding: 10px; }
          h2 { text-align: center; }
          p { margin: 4px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; }
        </style>
        </head>
        <body>
          <h2>BAR RECEIPT</h2>
          <p>Receipt #: ${receipt.receipt_number}</p>
          <p>Date: ${date}</p>
          <p>Customer: ${customer}</p>
          ${phone ? `<p>Phone: ${phone}</p>` : ''}
          <p>Cashier: ${cashier}</p>
          <p>Total: ${total}</p>
          <p>Status: ${receipt.tab?.status}</p>
          <div class="footer"><p>Thank you for your patronage!</p></div>
        </body>
      </html>
    `;
    receiptWindow.document.write(html);
    receiptWindow.document.close();
    receiptWindow.print();
    // Mark as printed in DB if not already
    if (!receipt.printed) {
      supabase.from('receipts').update({ printed: true }).eq('id', receipt.id);
    }
    toast.success('Reprinted');
  };

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">🧾 Receipts</h2>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Customer name or receipt #"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <button
            onClick={handleSearch}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            Search
          </button>
          <button
            onClick={() => {
              setSearchTerm('');
              setDateFrom('');
              setDateTo('');
              fetchReceipts();
            }}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No receipts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-500">Receipt #</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Customer</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Cashier</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Total</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Printed</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{r.receipt_number}</td>
                    <td className="px-4 py-3 font-medium">{r.tab?.customer_name || '—'}</td>
                    <td className="px-4 py-3">{r.tab?.cashier?.full_name || '—'}</td>
                    <td className="px-4 py-3 font-bold">{formatCurrency(r.tab?.total)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(r.created_at).toLocaleString('en-UG', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.printed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {r.printed ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleReprint(r)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        🖨️ Reprint
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
