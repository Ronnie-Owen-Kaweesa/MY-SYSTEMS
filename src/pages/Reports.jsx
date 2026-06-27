import React, { useState, useEffect } from 'react';
import supabase from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('daily_sales');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  
  // Report data
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
      switch (reportType) {
        case 'daily_sales':
          await fetchDailySales();
          break;
        case 'sales_by_product':
          await fetchSalesByProduct();
          break;
        case 'stock_variance':
          await fetchStockVariance();
          break;
        case 'profit':
          await fetchProfitByProduct();
          break;
        case 'cashier_performance':
          await fetchCashierPerformance();
          break;
        default:
          break;
      }
    } catch (err) {
      toast.error('Failed to load report');
    }
    setLoading(false);
  }

  async function fetchDailySales() {
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, payment_method, created_at')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end + 'T23:59:59');
    
    // Group by date
    const dailyMap = {};
    (payments || []).forEach(p => {
      const day = p.created_at.split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { date: day, total: 0, cash: 0, mtn: 0, airtel: 0, visa: 0, pesapal: 0, count: 0 };
      dailyMap[day].total += p.amount;
      dailyMap[day][p.payment_method] = (dailyMap[day][p.payment_method] || 0) + p.amount;
      dailyMap[day].count += 1;
    });
    const sorted = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));
    setDailySales(sorted);
    
    const totalSales = sorted.reduce((sum, d) => sum + d.total, 0);
    setSummary({ totalSales, days: sorted.length });
  }

  async function fetchSalesByProduct() {
    const { data: items } = await supabase
      .from('tab_items')
      .select('quantity, total, products(name, product_code), created_at')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end + 'T23:59:59');
    
    const productMap = {};
    (items || []).forEach(item => {
      const key = item.products?.name || 'Unknown';
      if (!productMap[key]) productMap[key] = { name: key, quantity: 0, revenue: 0 };
      productMap[key].quantity += item.quantity;
      productMap[key].revenue += item.total;
    });
    const sorted = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);
    setSalesByProduct(sorted);
    setSummary({ totalItems: items?.length || 0, uniqueProducts: sorted.length });
  }

  async function fetchStockVariance() {
    // Compare opening and closing stock counts per product, then compare with recorded sales
    const { data: counts } = await supabase
      .from('stock_counts')
      .select('product_id, count_type, quantity, created_at, products(name)')
      .order('created_at', { ascending: false })
      .limit(500);
    
    const productVar = {};
    // Find latest opening and closing per product
    (counts || []).forEach(c => {
      const pid = c.product_id;
      if (!productVar[pid]) productVar[pid] = { 
        name: c.products?.name || 'Unknown', 
        opening: null, closing: null, deliveries: 0, adjustments: 0 
      };
      if (c.count_type === 'opening' && !productVar[pid].opening) productVar[pid].opening = c.quantity;
      if (c.count_type === 'closing' && !productVar[pid].closing) productVar[pid].closing = c.quantity;
      if (c.count_type === 'delivery') productVar[pid].deliveries += c.quantity;
      if (c.count_type === 'adjustment') productVar[pid].adjustments += c.quantity;
    });
    
    // Now get sales per product in same period
    const { data: salesItems } = await supabase
      .from('tab_items')
      .select('product_id, quantity')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end + 'T23:59:59');
    
    const salesMap = {};
    (salesItems || []).forEach(s => { salesMap[s.product_id] = (salesMap[s.product_id] || 0) + s.quantity; });
    
    const varianceArr = Object.values(productVar).map(p => {
      const opening = p.opening || 0;
      const closing = p.closing || 0;
      const received = p.deliveries + p.adjustments;
      const expectedConsumption = opening + received - closing;
      const actualSales = salesMap[p.name] || 0; // rough mapping by product name
      const variance = actualSales - expectedConsumption;
      return { ...p, expectedConsumption, actualSales, variance };
    });
    setStockVariance(varianceArr);
  }

  async function fetchProfitByProduct() {
    const { data: items } = await supabase
      .from('tab_items')
      .select('quantity, total, unit_price, products(cost_price, name)')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end + 'T23:59:59');
    
    const profitMap = {};
    (items || []).forEach(item => {
      const name = item.products?.name || 'Unknown';
      const cost = item.products?.cost_price || 0;
      if (!profitMap[name]) profitMap[name] = { name, quantity: 0, revenue: 0, cost: 0 };
      profitMap[name].quantity += item.quantity;
      profitMap[name].revenue += item.total;
      profitMap[name].cost += cost * item.quantity;
    });
    const arr = Object.values(profitMap).map(p => ({
      ...p,
      profit: p.revenue - p.cost,
      margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue * 100).toFixed(1) : 0
    })).sort((a, b) => b.profit - a.profit);
    setProfitByProduct(arr);
    const totalProfit = arr.reduce((s, p) => s + p.profit, 0);
    setSummary({ totalProfit, totalRevenue: arr.reduce((s, p) => s + p.revenue, 0) });
  }

  async function fetchCashierPerformance() {
    const { data: shifts } = await supabase
      .from('shifts')
      .select('*, users!shifts_cashier_id_fkey(full_name)')
      .gte('opened_at', dateRange.start)
      .lte('opened_at', dateRange.end + 'T23:59:59');
    
    // For each shift, get total sales
    const perfMap = {};
    for (const shift of (shifts || [])) {
      const { data: tabs } = await supabase
        .from('tabs')
        .select('id')
        .eq('shift_id', shift.id)
        .eq('status', 'closed');
      let totalSales = 0;
      let totalItems = 0;
      for (const tab of (tabs || [])) {
        const { data: payments } = await supabase
          .from('payments')
          .select('amount')
          .eq('tab_id', tab.id);
        totalSales += (payments || []).reduce((s, p) => s + p.amount, 0);
        const { data: items } = await supabase
          .from('tab_items')
          .select('quantity')
          .eq('tab_id', tab.id);
        totalItems += (items || []).reduce((s, i) => s + i.quantity, 0);
      }
      const name = shift.users?.full_name || 'Unknown';
      if (!perfMap[name]) perfMap[name] = { name, shifts: 0, totalSales: 0, totalItems: 0, variance: 0 };
      perfMap[name].shifts += 1;
      perfMap[name].totalSales += totalSales;
      perfMap[name].totalItems += totalItems;
      perfMap[name].variance += shift.variance || 0;
    }
    setCashierPerformance(Object.values(perfMap));
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

  return (
    <div>
      {/* Header */}
      <h2 className="text-2xl font-bold text-gray-900 mb-6">📈 Reports</h2>

      {/* Report Type Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {reportTypes.map(rt => (
          <button
            key={rt.key}
            onClick={() => setReportType(rt.key)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              reportType === rt.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border'
            }`}
          >
            {rt.icon} {rt.label}
          </button>
        ))}
      </div>

      {/* Date Range Selector */}
      <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow">
        <div>
          <label className="block text-sm text-gray-600">Start Date</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            className="border rounded px-3 py-1"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">End Date</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            className="border rounded px-3 py-1"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Summary Cards */}
          {Object.keys(summary).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 border-b">
              {summary.totalSales !== undefined && (
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Sales</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalSales)}</p>
                </div>
              )}
              {summary.totalProfit !== undefined && (
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Profit</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalProfit)}</p>
                </div>
              )}
              {summary.totalRevenue !== undefined && (
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalRevenue)}</p>
                </div>
              )}
              {summary.days !== undefined && (
                <div className="text-center">
                  <p className="text-sm text-gray-500">Days</p>
                  <p className="text-2xl font-bold">{summary.days}</p>
                </div>
              )}
              {summary.totalItems !== undefined && (
                <div className="text-center">
                  <p className="text-sm text-gray-500">Items Sold</p>
                  <p className="text-2xl font-bold">{summary.totalItems}</p>
                </div>
              )}
              {summary.uniqueProducts !== undefined && (
                <div className="text-center">
                  <p className="text-sm text-gray-500">Unique Products</p>
                  <p className="text-2xl font-bold">{summary.uniqueProducts}</p>
                </div>
              )}
            </div>
          )}

          {/* Report Tables */}
          <div className="overflow-x-auto">
            {reportType === 'daily_sales' && (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cash</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">MTN</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Airtel</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Visa</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">PesaPal</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Transactions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dailySales.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No sales data in this period.</td></tr>
                  ) : (
                    dailySales.map(day => (
                      <tr key={day.date} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{day.date}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold">{formatCurrency(day.total)}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(day.cash)}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(day.mtn)}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(day.airtel)}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(day.visa)}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(day.pesapal)}</td>
                        <td className="px-4 py-3 text-sm text-right">{day.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {reportType === 'sales_by_product' && (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity Sold</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {salesByProduct.map(p => (
                    <tr key={p.name} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-sm text-right">{p.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold">{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'stock_variance' && (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Opening</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deliveries</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Closing</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expected Consumption</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actual Sales</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stockVariance.map(p => (
                    <tr key={p.name} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-sm text-right">{p.opening}</td>
                      <td className="px-4 py-3 text-sm text-right">{p.deliveries + p.adjustments}</td>
                      <td className="px-4 py-3 text-sm text-right">{p.closing}</td>
                      <td className="px-4 py-3 text-sm text-right">{p.expectedConsumption}</td>
                      <td className="px-4 py-3 text-sm text-right">{p.actualSales}</td>
                      <td className={`px-4 py-3 text-sm text-right font-bold ${p.variance > 0 ? 'text-green-600' : p.variance < 0 ? 'text-red-600' : ''}`}>
                        {p.variance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'profit' && (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity Sold</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Profit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {profitByProduct.map(p => (
                    <tr key={p.name} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-sm text-right">{p.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(p.revenue)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(p.cost)}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-green-600">{formatCurrency(p.profit)}</td>
                      <td className="px-4 py-3 text-sm text-right">{p.margin}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'cashier_performance' && (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cashier</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Shifts</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items Sold</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cash Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {cashierPerformance.map(c => (
                    <tr key={c.name} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-sm text-right">{c.shifts}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold">{formatCurrency(c.totalSales)}</td>
                      <td className="px-4 py-3 text-sm text-right">{c.totalItems}</td>
                      <td className={`px-4 py-3 text-sm text-right font-bold ${c.variance > 0 ? 'text-green-600' : c.variance < 0 ? 'text-red-600' : ''}`}>
                        {formatCurrency(c.variance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
