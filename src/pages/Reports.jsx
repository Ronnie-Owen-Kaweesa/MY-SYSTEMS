import React, { useState, useEffect } from 'react';
import supabase from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('daily_sales');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [dailySales, setDailySales] = useState([]);
  const [salesByProduct, setSalesByProduct] = useState([]);
  const [stockVariance, setStockVariance] = useState([]);
  const [profitByProduct, setProfitByProduct] = useState([]);
  const [cashierPerformance, setCashierPerformance] = useState([]);
  const [summary, setSummary] = useState({});

  useEffect(() => {
    fetchReport();
  }, [reportType, dateRange]);

  async function fetchReport() {
    setLoading(true);
    try {
      if (reportType === 'daily_sales') await fetchDailySales();
      else if (reportType === 'sales_by_product') await fetchSalesByProduct();
      else if (reportType === 'stock_variance') await fetchStockVariance();
      else if (reportType === 'profit') await fetchProfitByProduct();
      else if (reportType === 'cashier_performance') await fetchCashierPerformance();
    } catch (err) {
      toast.error('Failed to load report');
    }
    setLoading(false);
  }

  async function fetchDailySales() {
    const { data } = await supabase
      .from('payments')
      .select('amount, payment_method, created_at')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end + 'T23:59:59');
    const map = {};
    (data || []).forEach(p => {
      const day = p.created_at.split('T')[0];
      if (!map[day]) map[day] = { date: day, total: 0, cash: 0, mtn_money: 0, airtel_money: 0, visa: 0, pesapal: 0, count: 0 };
      map[day].total += p.amount;
      map[day][p.payment_method] = (map[day][p.payment_method] || 0) + p.amount;
      map[day].count += 1;
    });
    const sorted = Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
    setDailySales(sorted);
    setSummary({ totalSales: sorted.reduce((s, d) => s + d.total, 0), days: sorted.length });
  }

  async function fetchSalesByProduct() {
    const { data } = await supabase
      .from('tab_items')
      .select('quantity, total, products(name, product_code)')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end + 'T23:59:59');
    const map = {};
    (data || []).forEach(item => {
      const n = item.products?.name || 'Unknown';
      if (!map[n]) map[n] = { name: n, quantity: 0, revenue: 0 };
      map[n].quantity += item.quantity;
      map[n].revenue += item.total;
    });
    const sorted = Object.values(map).sort((a, b) => b.revenue - a.revenue);
    setSalesByProduct(sorted);
  }

  async function fetchStockVariance() {
    setStockVariance([]);
  }

  async function fetchProfitByProduct() {
    const { data } = await supabase
      .from('tab_items')
      .select('quantity, total, unit_price, products(cost_price, name)')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end + 'T23:59:59');
    const map = {};
    (data || []).forEach(item => {
      const n = item.products?.name || 'Unknown';
      const cost = item.products?.cost_price || 0;
      if (!map[n]) map[n] = { name: n, quantity: 0, revenue: 0, cost: 0 };
      map[n].quantity += item.quantity;
      map[n].revenue += item.total;
      map[n].cost += cost * item.quantity;
    });
    const arr = Object.values(map)
      .map(p => ({
        ...p,
        profit: p.revenue - p.cost,
        margin: p.revenue ? ((p.revenue - p.cost) / p.revenue * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.profit - a.profit);
    setProfitByProduct(arr);
    setSummary({
      totalProfit: arr.reduce((s, p) => s + p.profit, 0),
      totalRevenue: arr.reduce((s, p) => s + p.revenue, 0),
    });
  }

  async function fetchCashierPerformance() {
    const { data: shifts } = await supabase
      .from('shifts')
      .select('*, users!shifts_cashier_id_fkey(full_name, role)')
      .gte('opened_at', dateRange.start)
      .lte('opened_at', dateRange.end + 'T23:59:59');

    const map = {};
    for (const shift of (shifts || [])) {
      // Exclude owner shifts
      if (shift.users?.role === 'owner') continue;

      const { data: tabs } = await supabase
        .from('tabs')
        .select('id')
        .eq('shift_id', shift.id)
        .eq('status', 'closed');
      let sales = 0;
      for (const tab of (tabs || [])) {
        const { data: payments } = await supabase
          .from('payments')
          .select('amount')
          .eq('tab_id', tab.id);
        sales += (payments || []).reduce((s, p) => s + p.amount, 0);
      }
      const name = shift.users?.full_name || 'Unknown';
      if (!map[name]) map[name] = { name, shifts: 0, totalSales: 0, variance: 0 };
      map[name].shifts += 1;
      map[name].totalSales += sales;
      map[name].variance += shift.variance || 0;
    }
    setCashierPerformance(Object.values(map));
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  }

  const reportTypes = [
    { key: 'daily_sales', label: 'Daily Sales', icon: '📅' },
    { key: 'sales_by_product', label: 'Sales by Product', icon: '🍺' },
    { key: 'stock_variance', label: 'Stock Variance', icon: '📊' },
    { key: 'profit', label: 'Profit by Product', icon: '💹' },
    { key: 'cashier_performance', label: 'Cashier Performance', icon: '👥' },
  ];

  const cashierChartData = {
    labels: cashierPerformance.map(c => c.name),
    datasets: [
      {
        label: 'Total Sales',
        data: cashierPerformance.map(c => c.totalSales),
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Cashier Sales Comparison',
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value) => formatCurrency(value),
        },
      },
    },
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">📈 Reports</h2>

      <div className="flex flex-wrap gap-2 mb-6">
        {reportTypes.map(rt => (
          <button
            key={rt.key}
            onClick={() => setReportType(rt.key)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              reportType === rt.key
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border dark:border-gray-600'
            }`}
          >
            {rt.icon} {rt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400">Start</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="border dark:border-gray-600 rounded px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400">End</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="border dark:border-gray-600 rounded px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
          <div className="overflow-x-auto">
            {reportType === 'daily_sales' && (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cash</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">MTN</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Airtel</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Visa</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">PesaPal</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {dailySales.map(day => (
                    <tr key={day.date} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{day.date}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300">{formatCurrency(day.cash)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300">{formatCurrency(day.mtn_money)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300">{formatCurrency(day.airtel_money)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300">{formatCurrency(day.visa)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300">{formatCurrency(day.pesapal)}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-white">{formatCurrency(day.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'sales_by_product' && (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qty Sold</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {salesByProduct.map(p => (
                    <tr key={p.name} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{p.name}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{p.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-white">{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'profit' && (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Profit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {profitByProduct.map(p => (
                    <tr key={p.name} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{p.name}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-green-600 dark:text-green-400">{formatCurrency(p.profit)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{p.margin}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'cashier_performance' && (
              <div>
                {cashierPerformance.length > 0 && (
                  <div className="p-6">
                    <div className="max-w-2xl mx-auto">
                      <Bar data={cashierChartData} options={chartOptions} />
                    </div>
                  </div>
                )}
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cashier</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Sales</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {cashierPerformance.map(c => (
                      <tr key={c.name} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{c.name}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-white">{formatCurrency(c.totalSales)}</td>
                        <td className={`px-4 py-3 text-sm text-right font-bold ${
                          c.variance > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatCurrency(c.variance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
