import React, { useState, useEffect } from 'react';
import supabase from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'pesapal', label: 'PesaPal', icon: '📱' },
  { value: 'mtn_money', label: 'MTN Money', icon: '📲' },
  { value: 'visa', label: 'Visa Card', icon: '💳' },
  { value: 'airtel_money', label: 'Airtel Money', icon: '📶' },
];

export default function Sales() {
  const { user } = useAuth();
  const [activeShift, setActiveShift] = useState(null);
  const [tabs, setTabs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(null);
  const [tabItems, setTabItems] = useState([]);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [showNewTab, setShowNewTab] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [receiptPreview, setReceiptPreview] = useState(null);

  // Customer history
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [customerHistory, setCustomerHistory] = useState([]);
  const [historySuggestions, setHistorySuggestions] = useState([]);

  // Auto-suggest for new tab
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([checkActiveShift(), fetchProducts(), fetchTabs()]);
    setLoading(false);
  };

  const checkActiveShift = async () => {
    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('cashier_id', user.id)
      .eq('status', 'open')
      .single();
    setActiveShift(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');
    setProducts(data || []);
  };

  const fetchTabs = async () => {
    const { data } = await supabase
      .from('tabs')
      .select('*')
      .order('opened_at', { ascending: false });
    setTabs(data || []);
  };

  const fetchTabItems = async (tabId) => {
    const { data } = await supabase
      .from('tab_items')
      .select('*, products(name, product_code)')
      .eq('tab_id', tabId);
    setTabItems(data || []);
  };

  const calculateTotal = () => {
    return tabItems.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const handleStartOwnerShift = async () => {
    const { data, error } = await supabase
      .from('shifts')
      .insert([{
        cashier_id: user.id,
        shift_type: 'owner',
        opening_cash: 0,
        status: 'open',
        notes: 'Auto-created for owner'
      }])
      .select()
      .single();

    if (error) {
      toast.error('Failed to create shift');
      return;
    }
    toast.success('Owner shift started');
    setActiveShift(data);
  };

  const handleNameChange = async (value) => {
    setNewCustomerName(value);
    if (value.length > 0) {
      const { data } = await supabase
        .from('tabs')
        .select('customer_name, phone_number')
        .ilike('customer_name', `%${value}%`)
        .order('opened_at', { ascending: false })
        .limit(10);
      const unique = Array.from(new Map((data || []).map(d => [d.customer_name, d])).values());
      setSuggestions(unique);
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (cust) => {
    setNewCustomerName(cust.customer_name);
    setNewCustomerPhone(cust.phone_number || '');
    setSuggestions([]);
  };

  const handleOpenTab = async () => {
    if (!activeShift) {
      toast.error('No active shift. Please start one first.');
      return;
    }
    if (!newCustomerName.trim()) {
      toast.error('Enter customer name');
      return;
    }
    const { data, error } = await supabase
      .from('tabs')
      .insert([{
        customer_name: newCustomerName.trim(),
        phone_number: newCustomerPhone.trim() || null,
        cashier_id: user.id,
        shift_id: activeShift.id,
        status: 'open'
      }])
      .select()
      .single();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Tab opened');
      setNewCustomerName('');
      setNewCustomerPhone('');
      setSuggestions([]);
      setShowNewTab(false);
      fetchTabs();
      setActiveTab(data);
      fetchTabItems(data.id);
    }
  };

  // History autocomplete
  const handleHistorySearchChange = async (value) => {
    setHistorySearch(value);
    if (value.trim().length > 0) {
      const { data } = await supabase
        .from('tabs')
        .select('customer_name')
        .ilike('customer_name', `%${value.trim()}%`)
        .order('opened_at', { ascending: false })
        .limit(8);
      const unique = Array.from(new Map((data || []).map(d => [d.customer_name, d])).values());
      setHistorySuggestions(unique);
    } else {
      setHistorySuggestions([]);
    }
  };

  const searchCustomerHistory = async (nameOverride) => {
    const searchName = nameOverride || historySearch;
    if (!searchName.trim()) {
      toast.error('Enter a customer name to search');
      return;
    }

    const { data, error } = await supabase
      .from('tabs')
      .select(`
        *,
        cashier:users!tabs_cashier_id_fkey (full_name),
        payments (*),
        tab_items (*, products (name, product_code))
      `)
      .ilike('customer_name', `%${searchName.trim()}%`)
      .order('opened_at', { ascending: false });

    if (error) {
      toast.error('Search failed');
      console.error(error);
      return;
    }

    setCustomerHistory(data || []);
    setHistorySuggestions([]);
  };

  const handleAddItem = async () => {
    if (!activeTab) return;
    if (!selectedProduct) {
      toast.error('Select a product');
      return;
    }
    const qty = parseInt(quantity) || 1;
    if (qty < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }
    if (selectedProduct.current_stock < qty) {
      toast.error(`Not enough stock. Only ${selectedProduct.current_stock} left.`);
      return;
    }

    const item = {
      tab_id: activeTab.id,
      product_id: selectedProduct.id,
      quantity: qty,
      unit_price: selectedProduct.selling_price,
      total: (selectedProduct.selling_price * qty)
    };

    const { error: insertError } = await supabase.from('tab_items').insert([item]);
    if (insertError) {
      toast.error(insertError.message);
      return;
    }

    const newStock = selectedProduct.current_stock - qty;
    const { error: updateError } = await supabase
      .from('products')
      .update({ current_stock: newStock })
      .eq('id', selectedProduct.id);

    if (updateError) {
      toast.error('Stock update failed, but item added.');
    } else {
      toast.success(`${qty} x ${selectedProduct.name} added`);
      setProducts(prev =>
        prev.map(p =>
          p.id === selectedProduct.id
            ? { ...p, current_stock: newStock }
            : p
        )
      );
      if (newStock === 0) {
        setSelectedProduct(null);
      } else {
        setSelectedProduct(prev => prev ? { ...prev, current_stock: newStock } : null);
      }
    }

    fetchTabItems(activeTab.id);
    setQuantity(1);
    setSearchTerm('');
  };

  const handleRemoveItem = async (itemId, productId, itemQty) => {
    if (!activeTab) return;
    const { error } = await supabase
      .from('tab_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      toast.error(error.message);
      return;
    }

    const { data: productData } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', productId)
      .single();

    if (productData) {
      const restoredStock = productData.current_stock + itemQty;
      await supabase
        .from('products')
        .update({ current_stock: restoredStock })
        .eq('id', productId);

      setProducts(prev =>
        prev.map(p =>
          p.id === productId ? { ...p, current_stock: restoredStock } : p
        )
      );
    }

    toast.success('Item removed');
    fetchTabItems(activeTab.id);
  };

  const handlePayment = async () => {
    if (!activeTab || !paymentMethod || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Enter valid payment amount');
      return;
    }
    const total = calculateTotal();
    const paid = parseFloat(paymentAmount);
    if (paid < total) {
      toast.error('Amount less than total');
      return;
    }
    const { error: payError } = await supabase
      .from('payments')
      .insert([{
        tab_id: activeTab.id,
        amount: paid,
        payment_method: paymentMethod,
        confirmed_by: user.id,
        reference_number: null
      }]);
    if (payError) {
      toast.error(payError.message);
      return;
    }
    const { error: closeError } = await supabase
      .from('tabs')
      .update({ status: 'closed', total: total, closed_at: new Date().toISOString() })
      .eq('id', activeTab.id);
    if (closeError) {
      toast.error(closeError.message);
      return;
    }
    const receiptNumber = 'RCP-' + Date.now();
    const { data: receipt } = await supabase
      .from('receipts')
      .insert([{
        tab_id: activeTab.id,
        receipt_number: receiptNumber,
        printed: false,
        sms_sent: false,
        whatsapp_sent: false
      }])
      .select()
      .single();
    if (!receipt) {
      toast.error('Receipt generation failed');
    } else {
      toast.success(`Payment received. Receipt ${receiptNumber}`);
      setShowPayment(false);
      setReceiptPreview({
        ...receipt,
        tab: activeTab,
        items: tabItems,
        total,
        paid,
        change: paid - total,
        method: paymentMethod
      });
      setActiveTab(null);
      setTabItems([]);
      fetchTabs();
    }
    setPaymentAmount('');
    setPaymentMethod('cash');
  };

  const handlePrintReceipt = () => {
    if (!receiptPreview) return;
    const printWindow = window.open('', '_blank');
    const content = generateReceiptHTML(receiptPreview);
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    supabase.from('receipts').update({ printed: true }).eq('id', receiptPreview.id);
    toast.success('Receipt printed');
  };

  const generateReceiptHTML = (receipt) => {
    const date = new Date().toLocaleString('en-UG');
    let itemsHTML = receipt.items.map(item =>
      `<tr><td>${item.products?.name || 'Product'}</td><td>${item.quantity}</td><td>${formatCurrency(item.unit_price)}</td><td>${formatCurrency(item.total)}</td></tr>`
    ).join('');
    return `
      <html>
        <head><title>Receipt ${receipt.receipt_number}</title>
        <style>
          body { font-family: monospace; width: 280px; margin: 0 auto; padding: 10px; }
          h2 { text-align: center; }
          table { width: 100%; border-collapse: collapse; }
          th, td { text-align: left; padding: 4px; border-bottom: 1px dashed #ccc; }
          .total { font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; }
        </style>
        </head>
        <body>
          <h2>BAR RECEIPT</h2>
          <p>Receipt: ${receipt.receipt_number}</p>
          <p>Date: ${date}</p>
          <p>Customer: ${receipt.tab?.customer_name || 'N/A'}</p>
          <p>Cashier: ${user.name}</p>
          <table>
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>${itemsHTML}</tbody>
          </table>
          <p class="total">Total: ${formatCurrency(receipt.total)}</p>
          <p>Paid: ${formatCurrency(receipt.paid)} (${receipt.method})</p>
          <p>Change: ${formatCurrency(receipt.change)}</p>
          <div class="footer">
            <p>Thank you!</p>
            <p>${new Date().toLocaleDateString()}</p>
          </div>
        </body>
      </html>
    `;
  };

  const sendDigitalReceipt = async (type) => {
    if (!receiptPreview) return;
    toast.success(`Sending receipt via ${type}... (simulation)`);
    if (type === 'sms') {
      await supabase.from('receipts').update({ sms_sent: true }).eq('id', receiptPreview.id);
    } else {
      await supabase.from('receipts').update({ whatsapp_sent: true }).eq('id', receiptPreview.id);
    }
    toast.success(`Receipt sent via ${type}`);
  };

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.product_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!activeShift) {
    if (user.role === 'cashier') {
      return (
        <div className="text-center py-12">
          <p className="text-xl text-gray-600 mb-4">⚠️ You need to open a shift before making sales.</p>
          <button
            onClick={() => window.location.href = '/shifts'}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Shifts
          </button>
        </div>
      );
    } else if (user.role === 'owner') {
      return (
        <div className="text-center py-12">
          <p className="text-xl text-gray-600 mb-4">👑 Owner: start your shift to make sales.</p>
          <button
            onClick={handleStartOwnerShift}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium"
          >
            Start Owner Shift
          </button>
        </div>
      );
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">💰 Sales</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowHistory(!showHistory); if (showHistory) setCustomerHistory([]); }}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
          >
            {showHistory ? 'Active Tabs' : 'Customer History'}
          </button>
          <button
            onClick={() => setShowNewTab(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            + New Tab
          </button>
        </div>
      </div>

      {/* Customer History Search */}
      {showHistory ? (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-bold mb-4">🔍 Customer History</h3>
          <div className="flex gap-2 mb-4 relative">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Enter customer name"
                value={historySearch}
                onChange={(e) => handleHistorySearchChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                autoFocus
              />
              {historySuggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-white border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto">
                  {historySuggestions.map((s, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        setHistorySearch(s.customer_name);
                        setHistorySuggestions([]);
                        searchCustomerHistory(s.customer_name);
                      }}
                    >
                      {s.customer_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => searchCustomerHistory(historySearch)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Search
            </button>
          </div>

          {customerHistory.length > 0 && (
            <div className="space-y-6">
              {customerHistory.map(tab => (
                <div key={tab.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex flex-col md:flex-row md:justify-between mb-3">
                    <div>
                      <p className="font-bold text-lg">{tab.customer_name}</p>
                      {tab.phone_number && (
                        <p className="text-sm text-gray-500">📞 {tab.phone_number}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        {new Date(tab.opened_at).toLocaleString()} – 
                        <span className={`ml-1 font-medium ${tab.status === 'closed' ? 'text-green-600' : 'text-yellow-600'}`}>
                          {tab.status.toUpperCase()}
                        </span>
                      </p>
                      {tab.cashier && (
                        <p className="text-sm text-gray-600">Cashier: {tab.cashier.full_name}</p>
                      )}
                    </div>
                    <div className="text-right mt-2 md:mt-0">
                      <p className="text-sm text-gray-500">Total</p>
                      <p className="text-xl font-bold">{formatCurrency(tab.total)}</p>
                    </div>
                  </div>

                  {tab.tab_items && tab.tab_items.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-medium text-gray-700 mb-1">Items:</p>
                      <div className="bg-white rounded p-3 border">
                        {tab.tab_items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm py-1 border-b last:border-0">
                            <span>{item.products?.name} ({item.products?.product_code})</span>
                            <span>
                              {item.quantity} x {formatCurrency(item.unit_price)} = {formatCurrency(item.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {tab.payments && tab.payments.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Payments:</p>
                      {tab.payments.map((payment, idx) => (
                        <div key={idx} className="flex justify-between text-sm bg-white p-2 rounded border mb-1 last:mb-0">
                          <span className="capitalize">{payment.payment_method.replace('_', ' ')}</span>
                          <span className="font-medium">{formatCurrency(payment.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {tab.status === 'open' && (
                    <p className="text-xs text-yellow-600 mt-2">⚠️ This tab is still open – no payment recorded yet.</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {historySearch && customerHistory.length === 0 && (
            <p className="text-gray-500 text-center py-6">No records found for "{historySearch}".</p>
          )}
        </div>
      ) : (
        <>
          {activeTab ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Product Selection */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Add Items to {activeTab.customer_name}</h3>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      className={`px-4 py-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center ${selectedProduct?.id === product.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
                      onClick={() => {
                        if (product.current_stock > 0) {
                          setSelectedProduct(product);
                          setQuantity(1);
                        } else {
                          toast.error('Out of stock');
                        }
                      }}
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-gray-500">{product.product_code}</p>
                        <p className={`text-xs ${product.current_stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Stock: {product.current_stock}
                        </p>
                      </div>
                      <p className="font-bold">{formatCurrency(product.selling_price)}</p>
                    </div>
                  ))}
                </div>
                {selectedProduct && (
                  <div className="mt-4 flex gap-3 items-end">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Quantity</label>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => {
                          let val = parseInt(e.target.value) || 0;
                          if (val > selectedProduct.current_stock) val = selectedProduct.current_stock;
                          if (val < 1) val = 1;
                          setQuantity(val);
                        }}
                        min="1"
                        max={selectedProduct.current_stock}
                        className="w-20 border rounded px-2 py-1"
                      />
                    </div>
                    <button
                      onClick={handleAddItem}
                      disabled={selectedProduct.current_stock < 1}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Add Item
                    </button>
                  </div>
                )}
              </div>

              {/* Tab Items */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">Tab: {activeTab.customer_name}</h3>
                  <button
                    onClick={() => { setActiveTab(null); setTabItems([]); }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕ Close
                  </button>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {tabItems.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No items yet.</p>
                  ) : (
                    tabItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center border-b pb-2">
                        <div>
                          <p className="font-medium">{item.products?.name}</p>
                          <p className="text-sm text-gray-500">
                            {item.quantity} x {formatCurrency(item.unit_price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold">{formatCurrency(item.total)}</span>
                          <button
                            onClick={() => handleRemoveItem(item.id, item.product_id, item.quantity)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t mt-4 pt-4">
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(calculateTotal())}</span>
                  </div>
                  <button
                    onClick={() => setShowPayment(true)}
                    disabled={tabItems.length === 0}
                    className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Process Payment
                  </button>
                </div>
              </div>
            </div>
          ) : receiptPreview ? (
            /* Receipt Preview */
            <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-center mb-4">🧾 Receipt</h3>
              <div className="border p-4 rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600">Receipt #: {receiptPreview.receipt_number}</p>
                <p className="font-medium">Customer: {receiptPreview.tab?.customer_name}</p>
                {receiptPreview.tab?.phone_number && <p className="text-sm text-gray-500">📞 {receiptPreview.tab.phone_number}</p>}
                <p className="text-sm text-gray-600">Date: {new Date().toLocaleString()}</p>
                <div className="border-t my-2 pt-2">
                  {receiptPreview.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.products?.name} x{item.quantity}</span>
                      <span>{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 font-bold flex justify-between">
                  <span>Total</span>
                  <span>{formatCurrency(receiptPreview.total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Paid ({receiptPreview.method})</span>
                  <span>{formatCurrency(receiptPreview.paid)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Change</span>
                  <span>{formatCurrency(receiptPreview.change)}</span>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={handlePrintReceipt} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                  🖨️ Print
                </button>
                <button onClick={() => sendDigitalReceipt('sms')} className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                  📱 SMS
                </button>
                <button onClick={() => sendDigitalReceipt('whatsapp')} className="flex-1 bg-green-700 text-white py-2 rounded-lg hover:bg-green-800">
                  💬 WhatsApp
                </button>
              </div>
              <button onClick={() => setReceiptPreview(null)} className="w-full mt-3 bg-gray-200 py-2 rounded-lg hover:bg-gray-300">
                New Sale
              </button>
            </div>
          ) : (
            /* Open Tabs List */
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-bold text-lg">Open Tabs</h3>
              </div>
              <div className="divide-y">
                {tabs.filter(t => t.status === 'open').length === 0 ? (
                  <p className="p-6 text-gray-500 text-center">No open tabs. Click "+ New Tab" to start.</p>
                ) : (
                  tabs.filter(t => t.status === 'open').map(tab => (
                    <div
                      key={tab.id}
                      className="flex justify-between items-center px-4 py-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setActiveTab(tab);
                        fetchTabItems(tab.id);
                      }}
                    >
                      <div>
                        <p className="font-medium">{tab.customer_name}</p>
                        {tab.phone_number && <p className="text-sm text-gray-500">📞 {tab.phone_number}</p>}
                        <p className="text-sm text-gray-500">
                          Opened {new Date(tab.opened_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <span className="text-blue-600">→</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Payment Modal */}
      {showPayment && activeTab && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Payment for {activeTab.customer_name}</h3>
              <p className="text-2xl font-bold text-center mb-4">Total: {formatCurrency(calculateTotal())}</p>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map(method => (
                    <button
                      key={method.value}
                      onClick={() => setPaymentMethod(method.value)}
                      className={`p-2 rounded-lg border text-center ${paymentMethod === method.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                    >
                      <span className="text-2xl">{method.icon}</span>
                      <p className="text-xs mt-1">{method.label}</p>
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received (UGX)</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-xl text-center"
                    placeholder={calculateTotal().toString()}
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Change: {paymentAmount ? formatCurrency(paymentAmount - calculateTotal()) : formatCurrency(0)}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handlePayment} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700">
                  Confirm Payment
                </button>
                <button onClick={() => setShowPayment(false)} className="flex-1 bg-gray-200 py-2 rounded-lg font-medium hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Tab Modal */}
      {showNewTab && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Open New Tab</h3>
              <form onSubmit={(e) => { e.preventDefault(); handleOpenTab(); }}>
                <div className="mb-4 relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Enter or select customer name"
                    required
                    autoFocus
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto">
                      {suggestions.map((s, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex justify-between"
                          onClick={() => selectSuggestion(s)}
                        >
                          <span>{s.customer_name}</span>
                          {s.phone_number && <span className="text-xs text-gray-500">{s.phone_number}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (optional)</label>
                  <input
                    type="tel"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="e.g., 07XXXXXXXX"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">
                    Open Tab
                  </button>
                  <button type="button" onClick={() => { setShowNewTab(false); setSuggestions([]); }} className="flex-1 bg-gray-200 py-2 rounded-lg font-medium hover:bg-gray-300">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
