import React, { useState, useEffect } from 'react';
import supabase from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user } = useAuth();
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

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchCategories()]);
    setLoading(false);
  }

  async function fetchUsers() {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('full_name');
    setUsers(data || []);
  }

  async function fetchCategories() {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    setCategories(data || []);
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
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('PIN updated successfully');
      setShowPinForm(false);
      setNewPin('');
      setTargetUserId('');
      fetchUsers();
    }
  }

  async function handleToggleStatus(userId, currentStatus) {
    const { error } = await supabase
      .from('users')
      .update({ is_active: !currentStatus })
      .eq('id', userId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`User ${currentStatus ? 'deactivated' : 'activated'}`);
      fetchUsers();
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
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Category added');
      setNewCategory('');
      setShowCategoryForm(false);
      fetchCategories();
    }
  }

  const tabs = [
    { key: 'users', label: '👥 Users & PINs' },
    { key: 'categories', label: '📂 Categories' },
    { key: 'about', label: 'ℹ️ About' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">⚙️ Settings</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Users & PINs</h3>
            <button
              onClick={() => { setShowPinForm(false); setShowPinForm(true); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
            >
              + Change PIN
            </button>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{u.full_name}</td>
                    <td className="px-4 py-3 text-sm capitalize">{u.role}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => {
                          setTargetUserId(u.id);
                          setShowPinForm(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 mr-3 text-sm font-medium"
                      >
                        Change PIN
                      </button>
                      <button
                        onClick={() => handleToggleStatus(u.id, u.is_active)}
                        className={`text-sm font-medium ${
                          u.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'
                        }`}
                      >
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
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-4">Change PIN</h3>
                  <form onSubmit={handleChangePin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New PIN</label>
                      <input
                        type="password"
                        maxLength={6}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-xl tracking-widest"
                        placeholder="••••••"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium">
                        Update PIN
                      </button>
                      <button type="button" onClick={() => setShowPinForm(false)} className="flex-1 bg-gray-200 py-2 rounded-lg font-medium">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Categories</h3>
            <button
              onClick={() => setShowCategoryForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
            >
              + Add Category
            </button>
          </div>

          {/* Categories List */}
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map(cat => (
              <span key={cat.id} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                {cat.name}
              </span>
            ))}
          </div>

          {/* Add Category Modal */}
          {showCategoryForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-4">Add Category</h3>
                  <form onSubmit={handleAddCategory} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                      <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="e.g., Cocktails"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium">
                        Add
                      </button>
                      <button type="button" onClick={() => setShowCategoryForm(false)} className="flex-1 bg-gray-200 py-2 rounded-lg font-medium">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABOUT TAB */}
      {activeTab === 'about' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-2">About This System</h3>
          <div className="text-gray-600 space-y-2">
            <p><strong>Bar Management System v1.0</strong></p>
            <p>Built with React + Supabase</p>
            <p>Progressive Web App (offline-capable)</p>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm"><strong>Default PINs:</strong></p>
              <p className="font-mono">Owner: 123456</p>
              <p className="font-mono">Cashier 1 (Morning): 111111</p>
              <p className="font-mono">Cashier 2 (Evening): 222222</p>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500">Change these in the Users tab above.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
