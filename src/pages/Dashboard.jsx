import React, { useState, useEffect } from 'react';
import supabase from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [recentReceipts, setRecentReceipts] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);
  const [todaySales, setTodaySales] = useState(0);
  const [activeShift, setActiveShift] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    loadStats();
    if (user?.role === 'owner') {
      fetchRecentReceipts();
    }
  }, [user]);

  const loadStats = async () => {
    setLoadingStats(true);
    // 1. Today's sales (all payments where created_at is today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data: todayPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount')
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());

    if (!paymentsError && todayPayments) {
      const total = todayPayments.reduce((sum, p) => sum + p.amount, 0);
      setTodaySales(total);
    } else {
      console.error('Failed to fetch today sales:', paymentsError);
    }

    // 2. Active shift for current user
    const { data: shift } = await supabase
      .from('shifts')
      .select('*')
      .eq('cashier_id', user.id)
      .eq('status', 'open')
      .single();
    setActiveShift(shift);

    setLoadingStats(false);
  };

  const fetchRecentReceipts = async () => {
    setLoadingReceipts(true);
    const { data, error } = await supabase
      .from('receipts')
      .select(`
        receipt_number,
        created_at,
        printed,
        tab:tabs!inner (
          customer_name,
          total,
          status
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error) {
      setRecentReceipts(data || []);
    }
    setLoadingReceipts(false);
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount || 0);

  const stats = [
    {
      label: "Today's Sales",
      value: loadingStats ? '...' : formatCurrency(todaySales),
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Active Shift',
      value: activeShift ? `${activeShift.shift_type} (open)` : 'None',
      color: activeShift ? 'text-blue-600' : 'text-gray-400',
      bg: 'bg-blue-50',
    },
    {
      label: 'Products',
      value: '20',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div>
      <h2 className="font-display text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
      <p className="text-gray-500 mb-8">Welcome back, {user?.name}!</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow`}>
            <h3 className="text-lg font-semibold text-gray-700">{stat.label}</h3>
            <p className={`text-3xl font-bold mt-2 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Receipts (Owner only) */}
      {user?.role === 'owner' && (
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700">🧾 Recent Receipts</h3>
            <span className="text-sm text-gray-500">Last 10</span>
          </div>

          {loadingReceipts ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : recentReceipts.length === 0 ? (
            <p className="text-gray-400 text-center py-6">No receipts yet. Complete a sale to see them here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium text-gray-500">Receipt #</th>
                    <th className="px-4 py-2 font-medium text-gray-500">Customer</th>
                    <th className="px-4 py-2 font-medium text-gray-500">Total</th>
                    <th className="px-4 py-2 font-medium text-gray-500">Date</th>
                    <th className="px-4 py-2 font-medium text-gray-500">Status</th>
                    <th className="px-4 py-2 font-medium text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentReceipts.map((r) => (
                    <tr key={r.receipt_number} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs">{r.receipt_number}</td>
                      <td className="px-4 py-2 font-medium">{r.tab?.customer_name || '—'}</td>
                      <td className="px-4 py-2 font-bold">{formatCurrency(r.tab?.total)}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {new Date(r.created_at).toLocaleString('en-UG', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.tab?.status === 'closed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {r.tab?.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => {
                            const receiptWindow = window.open('', '_blank');
                            const html = `
                              <html>
                                <head><title>Receipt ${r.receipt_number}</title>
                                <style>
                                  body { font-family: monospace; width: 280px; margin: 0 auto; padding: 10px; }
                                  h2 { text-align: center; }
                                  p { margin: 4px 0; }
                                  .footer { text-align: center; margin-top: 20px; }
                                </style>
                                </head>
                                <body>
                                  <h2>RECEIPT</h2>
                                  <p>Receipt #: ${r.receipt_number}</p>
                                  <p>Customer: ${r.tab?.customer_name || 'N/A'}</p>
                                  <p>Total: ${formatCurrency(r.tab?.total)}</p>
                                  <p>Date: ${new Date(r.created_at).toLocaleString()}</p>
                                  <p>Status: ${r.tab?.status}</p>
                                  <div class="footer"><p>Thank you!</p></div>
                                </body>
                              </html>
                            `;
                            receiptWindow.document.write(html);
                            receiptWindow.document.close();
                            receiptWindow.print();
                          }}
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
      )}
    </div>
  );
}
