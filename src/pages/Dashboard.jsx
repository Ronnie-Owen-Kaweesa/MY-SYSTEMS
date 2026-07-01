import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { isOnline } from '../services/offlineDB';

export default function Dashboard() {
  const { user } = useAuth();

  if (!isOnline()) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-4">📡 No Internet Connection</p>
        <p className="text-gray-500 dark:text-gray-400 mb-6">The dashboard requires an active internet connection.</p>
        <button onClick={() => window.location.reload()} className="bg-brand-green text-white px-6 py-2 rounded-lg hover:bg-green-700">Reload</button>
      </div>
    );
  }

  const [todaySales, setTodaySales] = useState(0);
  const [activeShift, setActiveShift] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => { loadStats(); }, [user]);

  const loadStats = async () => {
    setLoadingStats(true);
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

    const { data: todayPayments } = await supabase
      .from('payments')
      .select('amount')
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());
    const total = (todayPayments || []).reduce((sum, p) => sum + p.amount, 0);
    setTodaySales(total);

    const { data: openShift } = await supabase
      .from('shifts')
      .select('*, users!shifts_cashier_id_fkey(full_name)')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .single();
    setActiveShift(openShift);
    setLoadingStats(false);
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(amount || 0);

  return (
    <div>
      <h2 className="font-display text-3xl font-bold text-brand-brown dark:text-white mb-2">Dashboard</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">Welcome back, {user?.name}!</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Today's Sales</h3>
          <p className="text-3xl font-bold mt-2 text-green-700 dark:text-green-400">{loadingStats ? '...' : formatCurrency(todaySales)}</p>
        </div>
        <div className="bg-brown-50 dark:bg-brown-900/20 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Active Shift</h3>
          {activeShift ? (
            <div className="mt-2">
              <p className="text-2xl font-bold text-brand-brown dark:text-white">{activeShift.users?.full_name || 'Unknown'}</p>
              <p className="text-sm text-brown-700 dark:text-brown-300 capitalize">{activeShift.shift_type} shift</p>
            </div>
          ) : <p className="text-3xl font-bold mt-2 text-gray-400 dark:text-gray-500">None</p>}
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Products</h3>
          <p className="text-3xl font-bold mt-2 text-yellow-800 dark:text-yellow-400">20</p>
        </div>
      </div>
    </div>
  );
}
