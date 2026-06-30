import React, { useState, useEffect } from 'react';
import supabase from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { isOnline } from '../services/offlineDB';

export default function Settings() {
  const { user } = useAuth();

  // ---------- ONLINE CHECK ----------
  if (!isOnline()) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-4">📡 No Internet Connection</p>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Settings require an active internet connection.
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

  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');

  // PIN change form
  const [showPinForm, setShowPinForm] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [targetUserId, setTargetUserId] = useState('');

  // Category form
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  // Reset confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [usersRes, catsRes] = await Promise.all([
      supabase.from('users').select('*').order('full_name'),
      supabase.from('categories').select('*').order('name'),
    ]);
    if (usersRes.error) toast.error('Failed to load users');
    else setUsers(usersRes.data || []);
    if (catsRes.error) toast.error('Failed to load categories');
    else setCategories(catsRes.data || []);
    setLoading(false);
  }

  async function handleChangePin(e) {
    e.preventDefault();
    if (!targetUserId || !newPin || newPin.length < 4) {
      toast.error('Select a user and enter a valid PIN (4-6 digits)');
      return;
    }
    const { error } = await supabase
      .from('users')
      .update({ pin_code: newPin })
      .eq('id', targetUserId);
    if (error) toast.error(error.message);
    else {
      toast.success('PIN updated');
      setShowPinForm(false);
      setNewPin('');
      setTargetUserId('');
      loadData();
    }
  }

  async function handleToggleStatus(userId, currentStatus) {
    const { error } = await supabase
      .from('users')
      .update({ is_active: !currentStatus })
      .eq('id', userId);
    if (error) toast.error(error.message);
    else {
      toast.success(`User ${currentStatus ? 'deactivated' : 'activated'}`);
      loadData();
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    if (!newCategory.trim()) {
      toast.error('Enter a category name');
      return;
    }
    const { error } = await supabase
      .from('categories')
      .insert([{ name: newCategory.trim() }]);
    if (error) toast.error(error.message);
    else {
      toast.success('Category added');
      setNewCategory('');
      setShowCategoryForm(false);
      loadData();
    }
  }

  async function handleResetAllData() {
    try {
      toast.loading('Resetting all data...');
      await supabase.from('receipts').delete().neq('id', '');
      await supabase.from('payments').delete().neq('id', '');
      await supabase.from('tab_items').delete().neq('id', '');
      await supabase.from('tabs').delete().neq('id', '');
      await supabase.from('stock_counts').delete().neq('id', '');
      await supabase.from('products').update({ current_stock: 0 }).neq('id', '');
      toast.dismiss();
      toast.success('All sales data has been reset');
      setShowResetConfirm(false);
    } catch (error) {
      toast.dismiss();
      toast.error('Reset failed: ' + error.message);
    }
  }

  const tabs = [
    { key: 'users', label: '👥 Users & PINs' },
    { key: 'categories', label: '📂 Categories' },
    { key: 'reset', label: '🔄 Reset Data' },
    { key: 'about', label: 'ℹ️ About' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">⚙️ Settings</h2>

      <div className="flex gap-2 mb-6 border-b dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Users & PINs</h3>
            <button
              onClick={() => setShowPinForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              + Change PIN
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{u.full_name}</td>
                    <td className="px-4 py-3 text-sm capitalize text-gray-900 dark:text-white">{u.role}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${u.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setTargetUserId(u.id); setShowPinForm(true); }} className="text-blue-600 hover:text-blue-800 mr-3 text-sm">Change PIN</button>
                      <button onClick={() => handleToggleStatus(u.id, u.is_active)} className={`text-sm ${u.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Change PIN Modal */}
          {showPinForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Change PIN</h3>
                  <form onSubmit={handleChangePin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New PIN</label>
                      <input
                        type="password"
                        maxLength={6}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full border rounded-lg px-3 py-2 text-center text-xl tracking-widest bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="••••••"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium">Update PIN</button>
                      <button type="button" onClick={() => setShowPinForm(false)} className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 rounded-lg font-medium">Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Categories tab */}
      {activeTab === 'categories' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Categories</h3>
            <button onClick={() => setShowCategoryForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium">+ Add Category</button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map(cat => (
              <span key={cat.id} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm">{cat.name}</span>
            ))}
          </div>

          {showCategoryForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Category</h3>
                  <form onSubmit={handleAddCategory} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category Name</label>
                      <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="e.g., Cocktails" autoFocus />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium">Add</button>
                      <button type="button" onClick={() => setShowCategoryForm(false)} className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 rounded-lg font-medium">Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reset Data tab */}
      {activeTab === 'reset' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">🔄 Reset All Data</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            This will permanently delete all sales, receipts, tabs, payments, and stock counts. Product stock will be reset to zero.
            <br /><strong className="text-red-600">Products, users, and categories will NOT be deleted.</strong>
          </p>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-bold"
          >
            Reset All Data
          </button>

          {showResetConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">⚠️ Confirm Reset</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Are you sure you want to delete ALL sales data and reset stock to zero? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={handleResetAllData} className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold">Yes, Reset Everything</button>
                    <button onClick={() => setShowResetConfirm(false)} className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 rounded-lg font-medium">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* About tab */}
      {activeTab === 'about' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">About This System</h3>
          <div className="text-gray-600 dark:text-gray-300 space-y-2">
            <p><strong>Omuka Bar Management System v1.0</strong></p>
            <p>Built with React + Supabase</p>
            <p>Progressive Web App (installable)</p>
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Use the Reset Data tab to clear all sales and start fresh.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
