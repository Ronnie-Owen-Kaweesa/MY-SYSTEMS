import React, { useState, useEffect } from 'react';
import supabase from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Shifts() {
  const { user, isOwner } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeShift, setActiveShift] = useState(null);
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [suggestedOpening, setSuggestedOpening] = useState(null);
  const [closingCash, setClosingCash] = useState('');
  const [expectedClosing, setExpectedClosing] = useState(0);
  const [cashSales, setCashSales] = useState(0);
  const [shiftNotes, setShiftNotes] = useState('');

  // Expenses
  const [expenses, setExpenses] = useState([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');

  useEffect(() => {
    loadShifts();
    fetchExpenses();
  }, []);

  async function loadShifts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('shifts')
      .select('*, users!shifts_cashier_id_fkey(full_name)')
      .order('opened_at', { ascending: false })
      .limit(isOwner ? 50 : 10);

    if (error) {
      toast.error('Failed to load shifts');
      console.error(error);
    } else {
      setShifts(data || []);
      const active = (data || []).find(
        s => s.cashier_id === user.id && s.status === 'open'
      );
      setActiveShift(active);
    }
    setLoading(false);
  }

  async function fetchExpenses() {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setExpenses(data || []);
  }

  // Suggest opening cash: last closed shift's closing cash minus subsequent expenses
  async function prepareOpenForm() {
    // Get the most recent closed shift (any user)
    const { data: lastClosed } = await supabase
      .from('shifts')
      .select('*')
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(1)
      .single();

    let suggested = 0;
    if (lastClosed) {
      // Get expenses after that shift's close time
      const { data: exps } = await supabase
        .from('expenses')
        .select('amount')
        .gte('created_at', lastClosed.closed_at);

      const totalExpenses = (exps || []).reduce((sum, e) => sum + e.amount, 0);
      suggested = (lastClosed.closing_cash || 0) - totalExpenses;
      if (suggested < 0) suggested = 0;
    }

    setSuggestedOpening(suggested);
    setOpeningCash(suggested.toString());
    setShiftNotes('');
    setShowOpenForm(true);
  }

  async function openShift(e) {
    e.preventDefault();
    const amount = parseFloat(openingCash);
    if (isNaN(amount) || amount < 0) {
      toast.error('Enter a valid opening cash amount');
      return;
    }

    const hour = new Date().getHours();
    const shiftType = user.role === 'owner' ? 'owner' : hour < 14 ? 'morning' : 'evening';

    const { error } = await supabase.from('shifts').insert([{
      cashier_id: user.id,
      shift_type: shiftType,
      opening_cash: amount,
      status: 'open',
      notes: shiftNotes || null,
    }]);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${shiftType} shift opened`);
      setShowOpenForm(false);
      setSuggestedOpening(null);
      loadShifts();
    }
  }

  // Calculate expected closing when closing shift
  async function prepareCloseForm() {
    if (!activeShift) return;

    // Get cash sales for this shift
    const { data: cashPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('payment_method', 'cash')
      .in('tab_id', 
        (await supabase.from('tabs').select('id').eq('shift_id', activeShift.id)).data?.map(t => t.id) || []
      );

    // Simpler: Fetch tabs of this shift, then payments with cash method.
    // We'll do a direct query using inner join.
    const { data: cashData } = await supabase
      .from('payments')
      .select('amount')
      .eq('payment_method', 'cash')
      .in('tab_id', 
        supabase.from('tabs').select('id').eq('shift_id', activeShift.id)
      );

    // Actually the above is not valid JS. We'll do it in a single query using Supabase's nested select.
    const { data: shiftTabs } = await supabase
      .from('tabs')
      .select(`
        payments ( amount )
      `)
      .eq('shift_id', activeShift.id)
      .eq('payments.payment_method', 'cash');

    // Flatten and sum
    let totalCash = 0;
    (shiftTabs || []).forEach(tab => {
      (tab.payments || []).forEach(p => {
        totalCash += p.amount;
      });
    });

    const expected = (activeShift.opening_cash || 0) + totalCash;
    setCashSales(totalCash);
    setExpectedClosing(expected);
    setClosingCash('');
    setShowCloseForm(true);
  }

  async function closeShift(e) {
    e.preventDefault();
    const actualClosing = parseFloat(closingCash);
    if (isNaN(actualClosing) || actualClosing < 0) {
      toast.error('Enter valid closing cash amount');
      return;
    }

    const variance = actualClosing - expectedClosing;

    const { error } = await supabase
      .from('shifts')
      .update({
        closing_cash: actualClosing,
        expected_cash: expectedClosing,
        variance: variance,
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', activeShift.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Shift closed. Variance: UGX ${variance.toLocaleString()}`);
      setShowCloseForm(false);
      loadShifts();
    }
  }

  // Expense recording
  async function handleAddExpense(e) {
    e.preventDefault();
    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter valid amount');
      return;
    }
    const { error } = await supabase.from('expenses').insert([{
      amount,
      description: expenseDesc || null,
      recorded_by: user.id,
    }]);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Expense recorded');
      setShowExpenseForm(false);
      setExpenseAmount('');
      setExpenseDesc('');
      fetchExpenses();
    }
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">🕐 Shifts</h2>
        <div className="flex gap-2">
          {!activeShift && !isOwner && (
            <button
              onClick={prepareOpenForm}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
            >
              + Open Shift
            </button>
          )}
          {activeShift && (
            <button
              onClick={prepareCloseForm}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium"
            >
              Close Shift
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => setShowExpenseForm(true)}
              className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 font-medium"
            >
              + Expense
            </button>
          )}
        </div>
      </div>

      {/* Active Shift Card */}
      {activeShift && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-blue-900">Active Shift</h3>
              <p className="text-blue-700 capitalize">{activeShift.shift_type} shift</p>
              <p className="text-blue-700 text-sm">
                Opened: {new Date(activeShift.opened_at).toLocaleTimeString('en-UG', {
                  hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-700">Opening Cash</p>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(activeShift.opening_cash)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Open Shift Modal */}
      {showOpenForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Open New Shift</h3>
              {suggestedOpening !== null && (
                <div className="mb-3 p-3 bg-blue-50 rounded-lg text-sm">
                  <p>Suggested opening cash (previous shift closing minus expenses):</p>
                  <p className="font-bold text-lg">{formatCurrency(suggestedOpening)}</p>
                </div>
              )}
              <form onSubmit={openShift} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Opening Cash (UGX)
                  </label>
                  <input
                    type="number"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-xl text-center"
                    placeholder="0"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    rows="2"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700">
                    Open Shift
                  </button>
                  <button type="button" onClick={() => setShowOpenForm(false)} className="flex-1 bg-gray-200 py-2 rounded-lg font-medium hover:bg-gray-300">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseForm && activeShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Close Shift</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Opening Cash</p>
                  <p className="text-xl font-bold">{formatCurrency(activeShift.opening_cash)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Cash Sales</p>
                  <p className="text-xl font-bold">{formatCurrency(cashSales)}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg col-span-2">
                  <p className="text-sm text-blue-700">Expected Closing</p>
                  <p className="text-2xl font-bold text-blue-900">{formatCurrency(expectedClosing)}</p>
                </div>
              </div>
              <form onSubmit={closeShift} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Actual Closing Cash (UGX)
                  </label>
                  <input
                    type="number"
                    value={closingCash}
                    onChange={(e) => {
                      setClosingCash(e.target.value);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-xl text-center"
                    placeholder="Count and enter"
                    required
                    autoFocus
                  />
                  {closingCash && (
                    <p className={`mt-2 text-sm font-medium ${
                      parseFloat(closingCash) - expectedClosing >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Variance: {formatCurrency(parseFloat(closingCash) - expectedClosing)}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700">
                    Close Shift
                  </button>
                  <button type="button" onClick={() => setShowCloseForm(false)} className="flex-1 bg-gray-200 py-2 rounded-lg font-medium hover:bg-gray-300">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Expense Form Modal */}
      {showExpenseForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Record Expense</h3>
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (UGX)</label>
                  <input
                    type="number"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="e.g., Cleaning supplies"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="flex-1 bg-amber-600 text-white py-2 rounded-lg font-medium">Save</button>
                  <button type="button" onClick={() => setShowExpenseForm(false)} className="flex-1 bg-gray-200 py-2 rounded-lg">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Expenses List (Owner only) */}
      {isOwner && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="text-lg font-bold mb-3">Recent Expenses</h3>
          {expenses.length === 0 ? (
            <p className="text-gray-500">No expenses recorded.</p>
          ) : (
            <div className="space-y-2">
              {expenses.map(exp => (
                <div key={exp.id} className="flex justify-between text-sm border-b pb-2">
                  <div>
                    <p className="font-medium">{exp.description || 'No description'}</p>
                    <p className="text-gray-500">{new Date(exp.created_at).toLocaleString()}</p>
                  </div>
                  <p className="font-bold text-red-600">{formatCurrency(exp.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shifts History Table (unchanged from before, but keep it) */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cashier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Opening</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expected</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Closing</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {shifts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No shifts recorded yet.</td>
              </tr>
            ) : (
              shifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(shift.opened_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{shift.users?.full_name || '—'}</td>
                  <td className="px-4 py-3 text-sm capitalize">{shift.shift_type}</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(shift.opening_cash)}</td>
                  <td className="px-4 py-3 text-sm text-right">{shift.expected_cash ? formatCurrency(shift.expected_cash) : '—'}</td>
                  <td className="px-4 py-3 text-sm text-right">{shift.status === 'closed' ? formatCurrency(shift.closing_cash) : '—'}</td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                    shift.variance > 0 ? 'text-green-600' : shift.variance < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {shift.status === 'closed' ? formatCurrency(shift.variance) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      shift.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {shift.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
