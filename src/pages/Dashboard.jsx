import React, { useState, useEffect } from 'react';
import supabase from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [todaySales, setTodaySales] = useState(0);
  const [activeShift, setActiveShift] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    loadStats();
  }, [user]);

  const loadStats = async () => {
    setLoadingStats(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

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
      <h2 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">Welcome back, {user?.name}!</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Today's Sales */}
        <div className="bg-green-50 dark:bg-green-900/30 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Today's Sales</h3>
          <p className="text-3xl font-bold mt-2 text-green-600 dark:text-green-400">
            {loadingStats ? '...' : formatCurrency(todaySales)}
          </p>
        </div>

        {/* Active Shift */}
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Active Shift</h3>
          {activeShift ? (
            <div className="mt-2">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {activeShift.users?.full_name || 'Unknown'}
              </p>
              <p className="text-sm text-blue-500 dark:text-blue-300 capitalize">{activeShift.shift_type} shift</p>
              <p className="text-xs text-blue-400 dark:text-blue-300 mt-1">
                Opened {new Date(activeShift.opened_at).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ) : (
            <p className="text-3xl font-bold mt-2 text-gray-400 dark:text-gray-500">None</p>
          )}
        </div>

        {/* Products */}
        <div className="bg-amber-50 dark:bg-amber-900/30 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Products</h3>
          <p className="text-3xl font-bold mt-2 text-amber-600 dark:text-amber-400">20</p>
        </div>
      </div>
    </div>
  );
}
