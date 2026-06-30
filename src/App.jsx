import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './components/auth/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Shifts from './pages/Shifts';
import Sales from './pages/Sales';
import Reports from './pages/Reports';
import Receipts from './pages/Receipts';
import Debts from './pages/Debts';
import Settings from './pages/Settings';
import { listenToConnectivity } from './services/offlineDB';
import { syncAllPending } from './services/syncEngine';
import './index.css';

function App() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    listenToConnectivity(async () => {
      setOffline(false);
      await syncAllPending();
    });
    window.addEventListener('offline', () => setOffline(true));
    return () => window.removeEventListener('offline', () => {});
  }, []);

  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          {offline && (
            <div className="bg-yellow-500 text-black text-center py-1 text-sm font-medium">
              ⚡ You are offline – changes will sync automatically when reconnected.
            </div>
          )}
          <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#05C970', color: '#fff' } }} />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="shifts" element={<Shifts />} />
              <Route path="sales" element={<Sales />} />
              <Route path="reports" element={<ProtectedRoute requiredRole="owner"><Reports /></ProtectedRoute>} />
              <Route path="receipts" element={<ProtectedRoute requiredRole="owner"><Receipts /></ProtectedRoute>} />
              <Route path="debts" element={<ProtectedRoute requiredRole="owner"><Debts /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute requiredRole="owner"><Settings /></ProtectedRoute>} />
            </Route>
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
