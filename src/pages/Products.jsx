import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { isOnline } from '../services/offlineDB';

export default function Products() {
  const { user } = useAuth();

  // ---------- ONLINE CHECK ----------
  if (!isOnline()) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-4">📡 No Internet Connection</p>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Products require an active internet connection.
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
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({
    product_code: '',
    name: '',
    category_id: '',
    selling_price: '',
    cost_price: '',
    unit_type: 'bottle',
    units_per_container: '',
    reorder_level: 5,
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('name');
    if (error) {
      toast.error('Failed to load products');
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  }

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
  }

  function resetForm() {
    setForm({
      product_code: '',
      name: '',
      category_id: '',
      selling_price: '',
      cost_price: '',
      unit_type: 'bottle',
      units_per_container: '',
      reorder_level: 5,
    });
    setEditingProduct(null);
    setShowForm(false);
  }

  function openEditForm(product) {
    setEditingProduct(product);
    setForm({
      product_code: product.product_code,
      name: product.name,
      category_id: product.category_id || '',
      selling_price: product.selling_price,
      cost_price: product.cost_price || '',
      unit_type: product.unit_type,
      units_per_container: product.units_per_container || '',
      reorder_level: product.reorder_level || 5,
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const productData = {
      product_code: form.product_code,
      name: form.name,
      category_id: form.category_id || null,
      selling_price: parseFloat(form.selling_price),
      cost_price: form.cost_price ? parseFloat(form.cost_price) : 0,
      unit_type: form.unit_type,
      units_per_container: form.units_per_container ? parseInt(form.units_per_container) : null,
      reorder_level: parseInt(form.reorder_level) || 5,
    };

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);
        if (error) throw error;
        toast.success('Product updated');
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);
        if (error) throw error;
        toast.success('Product added');
      }
      resetForm();
      fetchProducts();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function toggleActive(product) {
    const { error } = await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id);
    if (error) {
      toast.error('Failed to update');
    } else {
      toast.success(product.is_active ? 'Product deactivated' : 'Product activated');
      fetchProducts();
    }
  }

  function formatPrice(price) {
    return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(price);
  }

  if (loading) {
    return <div className="flex justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">🍾 Products ({products.length})</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">+ Add Product</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border dark:border-gray-700">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Code</label>
                  <input type="text" value={form.product_code} onChange={(e) => setForm({...form, product_code: e.target.value})} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="e.g., P021" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Name</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="e.g., Nile Special" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <select value={form.category_id} onChange={(e) => setForm({...form, category_id: e.target.value})} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="">-- Select Category --</option>
                    {categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Selling Price (UGX)</label><input type="number" value={form.selling_price} onChange={(e) => setForm({...form, selling_price: e.target.value})} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="5000" required /></div>
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost Price (UGX)</label><input type="number" value={form.cost_price} onChange={(e) => setForm({...form, cost_price: e.target.value})} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="3500" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit Type</label><select value={form.unit_type} onChange={(e) => setForm({...form, unit_type: e.target.value})} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"><option value="bottle">Bottle</option><option value="crate">Crate</option><option value="carton">Carton</option></select></div>
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Units per Container</label><input type="number" value={form.units_per_container} onChange={(e) => setForm({...form, units_per_container: e.target.value})} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="24 (if applicable)" /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reorder Level</label><input type="number" value={form.reorder_level} onChange={(e) => setForm({...form, reorder_level: e.target.value})} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="5" /></div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">{editingProduct ? 'Update Product' : 'Add Product'}</button>
                  <button type="button" onClick={resetForm} className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cost</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {products.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No products found.</td></tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-300">{product.product_code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{product.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{product.categories?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">{formatPrice(product.selling_price)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">{product.cost_price ? formatPrice(product.cost_price) : '—'}</td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${product.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>{product.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openEditForm(product)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 mr-3 text-sm">Edit</button>
                      <button onClick={() => toggleActive(product)} className={`text-sm ${product.is_active ? 'text-red-600 dark:text-red-400 hover:text-red-800' : 'text-green-600 dark:text-green-400 hover:text-green-800'}`}>{product.is_active ? 'Deactivate' : 'Activate'}</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
