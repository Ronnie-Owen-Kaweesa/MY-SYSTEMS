import React, { useState, useEffect } from 'react';
import supabase from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('sales');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [aggregation, setAggregation] = useState('daily');
  const [salesData, setSalesData] = useState([]);
  const [salesByProduct, setSalesByProduct] = useState([]);
  const [profitByProduct, setProfitByProduct] = useState([]);
  const [cashierPerformance, setCashierPerformance] = useState([]);
  const [summary, setSummary] = useState({});

  useEffect(() => { fetchReport(); }, [reportType, dateRange, aggregation]);

  async function fetchReport() {
    setLoading(true);
    try {
      if (reportType === 'sales') await fetchSales();
      else if (reportType === 'product') await fetchSalesByProductData();
      else if (reportType === 'profit') await fetchProfitByProductData();
      else if (reportType === 'cashier') await fetchCashierPerformanceData();
    } catch (err) { toast.error('Failed to load report'); }
    setLoading(false);
  }

  async function fetchSales() {
    const { data: payments } = await supabase.from('payments').select('amount, payment_method, created_at').gte('created_at', dateRange.start).lte('created_at', dateRange.end + 'T23:59:59');
    const { data: expenses } = await supabase.from('expenses').select('amount, created_at').gte('created_at', dateRange.start).lte('created_at', dateRange.end + 'T23:59:59');
    const groupedPayments = groupByPeriod(payments || [], aggregation, 'sales');
    const groupedExpenses = groupByPeriod(expenses || [], aggregation, 'expenses');
    const allPeriods = new Set([...Object.keys(groupedPayments), ...Object.keys(groupedExpenses)]);
    const combined = Array.from(allPeriods).sort().map(period => {
      const sales = groupedPayments[period] || { total: 0, cash: 0, mtn_money: 0, airtel_money: 0, visa: 0, pesapal: 0, count: 0 };
      const expenseAmt = groupedExpenses[period]?.total || 0;
      return { period, totalSales: sales.total, cash: sales.cash, mtn_money: sales.mtn_money, airtel_money: sales.airtel_money, visa: sales.visa, pesapal: sales.pesapal, count: sales.count, expenses: expenseAmt, net: sales.total - expenseAmt };
    });
    setSalesData(combined);
    const totalSales = combined.reduce((s, d) => s + d.totalSales, 0);
    const totalExpenses = combined.reduce((s, d) => s + d.expenses, 0);
    setSummary({ totalSales, totalExpenses, net: totalSales - totalExpenses, periods: combined.length });
  }

  function groupByPeriod(records, agg, type = 'sales') {
    const map = {};
    records.forEach(record => {
      const date = new Date(record.created_at);
      let key;
      if (agg === 'daily') key = date.toISOString().split('T')[0];
      else if (agg === 'weekly') { const day = date.getDay(); const diff = date.getDate() - day + (day === 0 ? -6 : 1); const monday = new Date(date.setDate(diff)); key = monday.toISOString().split('T')[0]; }
      else if (agg === 'monthly') key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      else if (agg === 'yearly') key = `${date.getFullYear()}`;
      if (!map[key]) map[key] = { total: 0, cash: 0, mtn_money: 0, airtel_money: 0, visa: 0, pesapal: 0, count: 0 };
      map[key].total += record.amount || 0;
      if (type === 'sales' && record.payment_method) map[key][record.payment_method] = (map[key][record.payment_method] || 0) + record.amount;
      map[key].count += 1;
    });
    return map;
  }

  function formatPeriod(periodStr, agg) {
    if (agg === 'daily' || agg === 'weekly') {
      const parts = periodStr.split('-');
      if (parts.length === 3) {
        const date = new Date(periodStr + 'T00:00:00');
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = dayNames[date.getDay()];
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yy = String(date.getFullYear()).slice(-2);
        return `${dayName}, ${dd}-${mm}-${yy}`;
      }
    }
    return periodStr;
  }

  async function fetchSalesByProductData() {
    const { data } = await supabase.from('tab_items').select('quantity, total, products(name, product_code)').gte('created_at', dateRange.start).lte('created_at', dateRange.end + 'T23:59:59');
    const map = {};
    (data || []).forEach(item => {
      const n = item.products?.name || 'Unknown';
      if (!map[n]) map[n] = { name: n, quantity: 0, revenue: 0 };
      map[n].quantity += item.quantity;
      map[n].revenue += item.total;
    });
    setSalesByProduct(Object.values(map).sort((a, b) => b.revenue - a.revenue));
  }

  async function fetchProfitByProductData() {
    const { data } = await supabase.from('tab_items').select('quantity, total, unit_price, products(cost_price, name)').gte('created_at', dateRange.start).lte('created_at', dateRange.end + 'T23:59:59');
    const map = {};
    (data || []).forEach(item => {
      const n = item.products?.name || 'Unknown';
      const cost = item.products?.cost_price || 0;
      if (!map[n]) map[n] = { name: n, quantity: 0, revenue: 0, cost: 0 };
      map[n].quantity += item.quantity;
      map[n].revenue += item.total;
      map[n].cost += cost * item.quantity;
    });
    const arr = Object.values(map).map(p => ({ ...p, profit: p.revenue - p.cost, margin: p.revenue ? ((p.revenue - p.cost) / p.revenue * 100).toFixed(1) : 0 })).sort((a, b) => b.profit - a.profit);
    setProfitByProduct(arr);
    setSummary({ totalProfit: arr.reduce((s, p) => s + p.profit, 0), totalRevenue: arr.reduce((s, p) => s + p.revenue, 0) });
  }

  async function fetchCashierPerformanceData() {
    const { data: shifts } = await supabase.from('shifts').select('*, users!shifts_cashier_id_fkey(full_name, role)').gte('opened_at', dateRange.start).lte('opened_at', dateRange.end + 'T23:59:59');
    const map = {};
    for (const shift of (shifts || [])) {
      if (shift.users?.role === 'owner') continue;
      const { data: tabs } = await supabase.from('tabs').select('id').eq('shift_id', shift.id).eq('status', 'closed');
      let sales = 0;
      for (const tab of (tabs || [])) {
        const { data: payments } = await supabase.from('payments').select('amount').eq('tab_id', tab.id);
        sales += (payments || []).reduce((s, p) => s + p.amount, 0);
      }
      const name = shift.users?.full_name || 'Unknown';
      if (!map[name]) map[name] = { name, shifts: 0, totalSales: 0, variance: 0 };
      map[name].shifts += 1; map[name].totalSales += sales; map[name].variance += shift.variance || 0;
    }
    setCashierPerformance(Object.values(map));
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(amount || 0);
  }

  const chartData = {
    labels: salesData.map(d => formatPeriod(d.period, aggregation)),
    datasets: [{ label: 'Total Sales', data: salesData.map(d => d.totalSales), backgroundColor: 'rgba(34,197,94,0.6)', borderColor: 'rgba(34,197,94,1)', borderWidth: 1 }],
  };
  const cashierChartData = {
    labels: cashierPerformance.map(c => c.name),
    datasets: [{ label: 'Total Sales', data: cashierPerformance.map(c => c.totalSales), backgroundColor: 'rgba(34,197,94,0.6)', borderColor: 'rgba(34,197,94,1)', borderWidth: 1 }],
  };
  const chartOptions = {
    responsive: true,
    plugins: { legend: { position: 'top' }, title: { display: true, text: 'Sales Overview' } },
    scales: { y: { ticks: { callback: (value) => formatCurrency(value) } } },
  };

  const reportTypes = [
    { key: 'sales', label: 'Sales Report', icon: '📅' },
    { key: 'product', label: 'Sales by Product', icon: '🍺' },
    { key: 'profit', label: 'Profit by Product', icon: '💹' },
    { key: 'cashier', label: 'Cashier Performance', icon: '👥' },
  ];

  // Sets the document title to a PDF-friendly name, then prints, then restores
  const handleDownloadPDF = () => {
    const originalTitle = document.title;
    let pdfTitle = 'Omuka_Bar_report';
    if (reportType === 'sales') {
      pdfTitle = `Omuka_Bar_${aggregation}_sales_report`;
    } else if (reportType === 'product') {
      pdfTitle = 'Omuka_Bar_sales_by_product';
    } else if (reportType === 'profit') {
      pdfTitle = 'Omuka_Bar_profit_report';
    } else if (reportType === 'cashier') {
      pdfTitle = 'Omuka_Bar_cashier_performance';
    }
    document.title = pdfTitle;
    window.print();
    // Restore after a short delay (print dialog is synchronous in some browsers, but we wait)
    setTimeout(() => { document.title = originalTitle; }, 100);
  };

  return (
    <div>
      <style>{`@media print { .no-print, .sidebar, header, .hide-on-print, .print\\:hidden { display: none !important; } body { background: white !important; color: black !important; } .print-only { display: block !important; } table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } }`}</style>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 no-print">📈 Reports</h2>
      <div className="flex flex-wrap gap-2 mb-6 no-print">
        {reportTypes.map(rt => (
          <button key={rt.key} onClick={() => setReportType(rt.key)} className={`px-4 py-2 rounded-lg font-medium transition-colors ${reportType === rt.key ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border dark:border-gray-600'}`}>{rt.icon} {rt.label}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700 no-print">
        <div><label className="block text-sm text-gray-600 dark:text-gray-400">Start</label><input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="border dark:border-gray-600 rounded px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" /></div>
        <div><label className="block text-sm text-gray-600 dark:text-gray-400">End</label><input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="border dark:border-gray-600 rounded px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" /></div>
        {reportType === 'sales' && (
          <div><label className="block text-sm text-gray-600 dark:text-gray-400">Group by</label><select value={aggregation} onChange={(e) => setAggregation(e.target.value)} className="border dark:border-gray-600 rounded px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
        )}

        {/* Print + PDF buttons */}
        <button onClick={() => window.print()} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium no-print">🖨️ Print Report</button>
        <button onClick={handleDownloadPDF} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium no-print">📥 Download PDF</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-blue-400"></div></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700 print:bg-transparent print:border-none print:shadow-none">
          {reportType === 'sales' && (
            <div className="p-6 print:p-0">
              <div className="print-only hidden mb-4"><h3 className="text-xl font-bold">Omuka Bar - {aggregation} Sales Report</h3><p className="text-lg">Total Sales: {formatCurrency(summary.totalSales)} | Expenses: {formatCurrency(summary.totalExpenses)} | Net: {formatCurrency(summary.net)}</p></div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 capitalize no-print">{aggregation} Sales Summary</h3>
              {summary.totalSales !== undefined && (
                <div className="text-gray-600 dark:text-gray-300 mb-4 no-print">
                  <p>Total Sales: <strong>{formatCurrency(summary.totalSales)}</strong></p>
                  <p>Total Expenses: <strong className="text-red-600">{formatCurrency(summary.totalExpenses)}</strong></p>
                  <p>Net: <strong className={summary.net >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(summary.net)}</strong></p>
                </div>
              )}

              <div className="overflow-x-auto mb-8">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-300">Period</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-300 hide-on-print">Cash</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-300 hide-on-print">MTN</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-300 hide-on-print">Airtel</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-300 hide-on-print">Visa</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-300 hide-on-print">PesaPal</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-300">Sales</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-300">Expenses</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-300">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {salesData.map(day => (
                      <tr key={day.period} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{formatPeriod(day.period, aggregation)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300 hide-on-print">{formatCurrency(day.cash)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300 hide-on-print">{formatCurrency(day.mtn_money)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300 hide-on-print">{formatCurrency(day.airtel_money)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300 hide-on-print">{formatCurrency(day.visa)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300 hide-on-print">{formatCurrency(day.pesapal)}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-white">{formatCurrency(day.totalSales)}</td>
                        <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">{formatCurrency(day.expenses)}</td>
                        <td className={`px-4 py-3 text-sm text-right font-bold ${day.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(day.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {salesData.length > 0 && (
                <div className="max-w-2xl mx-auto mb-8 print:hidden">
                  <Bar data={chartData} options={chartOptions} />
                </div>
              )}

              <div className="print-only hidden mt-8 border-t pt-4 text-sm">
                <p className="mb-4">Report Period: {dateRange.start} to {dateRange.end}  |  Aggregation: {aggregation}</p>
                <div className="flex justify-between">
                  <div className="flex-1 mr-4">
                    <p className="mb-2">Owner's Name: ________________________</p>
                    <p className="mb-2">Signature: ___________________________</p>
                    <p>Date: _______________________________</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {reportType === 'product' && (
            <div className="p-6 print:p-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Sales by Product</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-300">Product</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-300">Qty Sold</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-300">Revenue</th>
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
              </div>
              <div className="print-only hidden mt-8 border-t pt-4 text-sm">
                <p className="mb-4">Report Period: {dateRange.start} to {dateRange.end}</p>
                <div className="flex justify-between">
                  <div className="flex-1 mr-4">
                    <p className="mb-2">Owner's Name: ________________________</p>
                    <p className="mb-2">Signature: ___________________________</p>
                    <p>Date: _______________________________</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {reportType === 'profit' && (
            <div className="p-6 print:p-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Profit by Product</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-300">Product</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-300">Profit</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-300">Margin</th>
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
              </div>
              <div className="print-only hidden mt-8 border-t pt-4 text-sm">
                <p className="mb-4">Report Period: {dateRange.start} to {dateRange.end}</p>
                <div className="flex justify-between">
                  <div className="flex-1 mr-4">
                    <p className="mb-2">Owner's Name: ________________________</p>
                    <p className="mb-2">Signature: ___________________________</p>
                    <p>Date: _______________________________</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {reportType === 'cashier' && (
            <div className="p-6 print:p-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Cashier Performance</h3>
              {cashierPerformance.length > 0 && <div className="max-w-2xl mx-auto mb-8 print:hidden"><Bar data={cashierChartData} options={chartOptions} /></div>}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-300">Cashier</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-300">Sales</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-300">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {cashierPerformance.map(c => (
                      <tr key={c.name} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{c.name}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-white">{formatCurrency(c.totalSales)}</td>
                        <td className={`px-4 py-3 text-sm text-right font-bold ${c.variance > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(c.variance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="print-only hidden mt-8 border-t pt-4 text-sm">
                <p className="mb-4">Report Period: {dateRange.start} to {dateRange.end}</p>
                <div className="flex justify-between">
                  <div className="flex-1 mr-4">
                    <p className="mb-2">Owner's Name: ________________________</p>
                    <p className="mb-2">Signature: ___________________________</p>
                    <p>Date: _______________________________</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
