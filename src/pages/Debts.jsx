import React, { useState, useEffect } from 'react';
import supabase from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { isOnline } from '../services/offlineDB';

export default function Debts() {
  const { user } = useAuth();

  if (!isOnline()) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-4">📡 No Internet Connection</p>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Debts require an active internet connection.</p>
        <button onClick={() => window.location.reload()} className="bg-brand-green text-white px-6 py-2 rounded-lg hover:bg-green-700">Reload</button>
      </div>
    );
  }

  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDebts(); }, []);

  async function fetchDebts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('tabs')
      .select('*')
      .eq('status', 'credit')
      .order('opened_at', { ascending: false });
    if (!error) setDebts(data || []);
    else toast.error('Failed to load debts');
    setLoading(false);
  }

  const handleMarkPaid = async (tab) => {
    if (!window.confirm(`Mark this debt of UGX ${tab.total?.toLocaleString()} as paid?`)) return;
    await supabase.from('payments').insert([{
      tab_id: tab.id,
      amount: tab.total,
      payment_method: 'cash',
      confirmed_by: user.id,
    }]);
    await supabase.from('tabs').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', tab.id);
    toast.success('Debt marked as paid');
    fetchDebts();
  };

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(amount || 0);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-brand-brown dark:text-white mb-6">💳 Outstanding Debts</h2>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-green"></div></div> :
        debts.length === 0 ? <p className="text-gray-500 dark:text-gray-400 text-center py-12">No outstanding debts.</p> :
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr><th className="px-4 py-3 text-left">Customer</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-center">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {debts.map(tab => (
                  <tr key={tab.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-medium">{tab.customer_name}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(tab.total)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(tab.opened_at).toLocaleDateString('en-UG', { day:'numeric', month:'short', year:'numeric' })}</td>
                    <td className="px-4 py-3 text-center"><button onClick={() => handleMarkPaid(tab)} className="bg-brand-green hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm font-medium">Mark as Paid</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }
    </div>
  );
}
