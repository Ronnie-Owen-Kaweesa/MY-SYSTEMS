import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { isOnline } from '../services/offlineDB';

export default function Inventory() {
  const { user } = useAuth();

  // ---------- ONLINE CHECK ----------
  if (!isOnline()) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-4">📡 No Internet Connection</p>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Inventory requires an active internet connection.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-brand-green text-white px-6 py-2 rounded-lg hover:bg-green-700"
        >
          Reload
        </button>
      </div>
    );
  }
  // ---------- END ONLINE CHECK ----------

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState({ product_id: '', count_type: 'delivery', quantity: '', notes: '' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([fetchProducts(), fetchHistory()]);
    setLoading(false);
  }

  async function fetchProducts() {
    const { data, error } = await supabase.from('products').select('*').eq('is_active', true).order('name');
    if (error) { toast.error('Failed to load products'); return; }
    setProducts(data || []);
  }

  async function fetchHistory() {
    const { data, error } = await supabase
      .from('stock_counts')
      .select('*, products(name, product_code), users!stock_counts_counted_by_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) { console.error(error); return; }
    setHistory(data || []);
  }

  function getCurrentStock(product) { return product.current_stock ?? 0; }

  function getStockStatus(product) {
    const stock = getCurrentStock(product);
    if (stock === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
    if (stock <= (product.reorder_level || 5)) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' };
    return { label: 'In Stock', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
  }

  function resetForm() {
    setForm({ product_id: '', count_type: 'delivery', quantity: '', notes: '' });
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.product_id || !form.quantity) { toast.error('Please select a product and enter quantity'); return; }
    const qty = parseInt(form.quantity);
    const countType = form.count_type;

    const { data: productData, error: fetchError } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', form.product_id)
      .single();
    if (fetchError) { toast.error('Failed to fetch product'); return; }

    let newStock = productData.current_stock;
    if (countType === 'delivery') newStock += qty;
    else if (countType === 'opening' || countType === 'closing' || countType === 'adjustment') newStock = qty;

    const { error: updateError } = await supabase
      .from('products')
      .update({ current_stock: newStock })
      .eq('id', form.product_id);
    if (updateError) { toast.error('Failed to update stock: ' + updateError.message); return; }

    const { error: insertError } = await supabase.from('stock_counts').insert([{
      product_id: form.product_id,
      count_type: countType,
      quantity: qty,
      counted_by: user.id,
      notes: form.notes || null,
    }]);
    if (insertError) console.warn('History insert failed:', insertError.message);

    toast.success('Stock updated successfully');
    resetForm();
    loadData();
  }

  if (loading) return <div className="flex justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">📦 Inventory</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowHistory(!showHistory)} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium">{showHistory ? 'View Stock' : 'View History'}</button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">+ Record Stock</button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border dark:border-gray-700">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Record Stock Count</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product</label><select value={form.product_id} onChange={(e) => setForm({...form, product_id: e.target.value})} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required><option value="">-- Select Product --</option>{products.map(p => (<option key={p.id} value={p.id}>{p.product_code} - {p.name} (Current: {p.current_stock})</option>))}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Count Type</label><select value={form.count_type} onChange={(e) => setForm({...form, count_type: e.target.value})} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"><option value="delivery">📥 Delivery (Stock In)</option><option value="opening">🌅 Opening Count</option><option value="closing">🌙 Closing Count</option><option value="adjustment">🔧 Adjustment (Set Count)</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity (Bottles)</label><input type="number" value={form.quantity} onChange={(e) => setForm({...form, quantity: e.target.value})} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Enter number" required min="0" /></div>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label><textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" rows="2" /></div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium">Save Record</button>
                  <button type="button" onClick={resetForm} className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 rounded-lg font-medium">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showHistory ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Product</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qty</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">User</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {history.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No records yet.</td></tr> :
                  history.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-medium">{r.products?.name} ({r.products?.product_code})</td>
                      <td className="px-4 py-3 text-sm"><span className={`px-2 py-1 text-xs rounded-full ${r.count_type === 'delivery' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>{r.count_type}</span></td>
                      <td className="px-4 py-3 text-sm text-right font-mono">{r.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{r.users?.full_name}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border dark:border-gray-700"><p className="text-sm text-gray-500 dark:text-gray-400">Total Products</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{products.length}</p></div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border dark:border-gray-700"><p className="text-sm text-gray-500 dark:text-gray-400">Out of Stock</p><p className="text-2xl font-bold text-red-600 dark:text-red-400">{products.filter(p => p.current_stock === 0).length}</p></div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border dark:border-gray-700"><p className="text-sm text-gray-500 dark:text-gray-400">Low Stock</p><p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{products.filter(p => p.current_stock > 0 && p.current_stock <= (p.reorder_level || 5)).length}</p></div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Code</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Product</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Stock</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Container</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {products.map(p => {
                    const stock = p.current_stock;
                    const status = getStockStatus(p);
                    const containers = p.units_per_container ? `${Math.floor(stock / p.units_per_container)} crates + ${stock % p.units_per_container} bottles` : '—';
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-300">{p.product_code}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{p.name}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-white">{stock}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">{containers}</td>
                        <td className="px-4 py-3 text-center"><span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${status.color}`}>{status.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
