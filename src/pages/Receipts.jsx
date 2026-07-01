import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { isOnline } from '../services/offlineDB';

export default function Receipts() {
  const { user } = useAuth();

  if (!isOnline()) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-4">📡 No Internet Connection</p>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Receipts require an active internet connection.</p>
        <button onClick={() => window.location.reload()} className="bg-brand-green text-white px-6 py-2 rounded-lg hover:bg-green-700">Reload</button>
      </div>
    );
  }

  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { fetchReceipts(); }, []);

  async function fetchReceipts(search = '', from = '', to = '') {
    setLoading(true);
    try {
      let query = supabase.from('receipts').select('*').order('created_at', { ascending: false }).limit(100);
      if (search) query = query.or(`receipt_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
      if (from) query = query.gte('created_at', `${from}T00:00:00`);
      if (to) query = query.lte('created_at', `${to}T23:59:59`);
      const { data, error } = await query;
      if (error) throw error;
      setReceipts(data || []);
    } catch (error) { toast.error('Failed to load receipts'); } finally { setLoading(false); }
  }

  const handleSearch = () => { fetchReceipts(searchTerm, dateFrom, dateTo); };

  const handleReprint = (receipt) => {
    const win = window.open('', '_blank');
    const date = new Date(receipt.created_at).toLocaleString('en-UG');
    const customer = receipt.customer_name || 'N/A';
    const cashier = receipt.cashier_name || 'N/A';
    const total = formatCurrency(receipt.total_amount);
    const html = `<html><head><title>Omuka Bar Receipt ${receipt.receipt_number}</title><style>body{font-family:monospace;width:280px;margin:0 auto;padding:10px}h2{text-align:center}p{margin:4px 0}.footer{text-align:center;margin-top:20px}</style></head><body><h2>OMUKA BAR RECEIPT</h2><p>Receipt #: ${receipt.receipt_number}</p><p>Date: ${date}</p><p>Customer: ${customer}</p><p>Cashier: ${cashier}</p><p>Total: ${total}</p><div class="footer"><p>Thank you for choosing Omuka Bar!</p></div></body></html>`;
    win.document.write(html); win.document.close(); win.print();
    if (!receipt.printed) { supabase.from('receipts').update({ printed: true }).eq('id', receipt.id); }
    toast.success('Reprinted');
  };

  function formatCurrency(amount) { return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(amount || 0); }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">🧾 Receipts</h2>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]"><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Search</label><input type="text" placeholder="Customer name or receipt #" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-700" /></div>
          <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">From</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border rounded-lg px-3 py-2 bg-white dark:bg-gray-700" /></div>
          <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">To</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border rounded-lg px-3 py-2 bg-white dark:bg-gray-700" /></div>
          <button onClick={handleSearch} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Search</button>
          <button onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo(''); fetchReceipts(); }} className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg">Clear</button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div> :
        receipts.length === 0 ? <div className="text-center py-12 text-gray-500">No receipts found.</div> :
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr><th className="px-4 py-3 text-left">Receipt #</th><th className="px-4 py-3 text-left">Customer</th><th className="px-4 py-3 text-left">Cashier</th><th className="px-4 py-3 text-left">Total</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Printed</th><th className="px-4 py-3 text-left">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {receipts.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 font-mono text-xs">{r.receipt_number}</td>
                      <td className="px-4 py-3 font-medium">{r.customer_name || '—'}</td>
                      <td className="px-4 py-3">{r.cashier_name || '—'}</td>
                      <td className="px-4 py-3 font-bold">{formatCurrency(r.total_amount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString('en-UG', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.printed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.printed ? 'Yes' : 'No'}</span></td>
                      <td className="px-4 py-3"><button onClick={() => handleReprint(r)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">🖨️ Reprint</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      }
    </div>
  );
}
