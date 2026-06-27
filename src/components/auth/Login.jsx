import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Login() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pin.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }
    setLoading(true);
    try {
      await login(pin);
      toast.success('Welcome!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Invalid PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-dark via-gray-900 to-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10">
        <div className="absolute top-20 left-20 w-64 h-64 bg-brand-accent rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-brand-burgundy rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-accent/10 rounded-full mb-4">
              <span className="text-4xl">🍺</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-gray-900 mb-2">Bar Manager</h1>
            <p className="text-gray-500 font-medium">Enter your PIN to continue</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full px-4 py-4 text-center text-3xl tracking-[0.3em] font-mono border-2 border-gray-200 rounded-xl focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/20 outline-none transition-all"
                autoFocus
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="w-full bg-brand-accent hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-lg shadow-lg shadow-amber-500/30"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Verifying...
                </span>
              ) : 'Enter'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Owner PIN: 123456 • Cashier: 111111 / 222222
          </p>
        </div>
      </div>
    </div>
  );
}
