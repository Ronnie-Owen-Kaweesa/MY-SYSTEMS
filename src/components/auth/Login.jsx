import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Login() {
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = useCallback(async (input) => {
    setLoading(true);
    try {
      await login(input);
      toast.success('Welcome!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Login failed');
      setCredential('');
    } finally {
      setLoading(false);
    }
  }, [login, navigate]);

  useEffect(() => {
    if (loading) return;
    const isNumeric = /^\d+$/.test(credential);
    if (isNumeric && credential.length === 6) {
      handleLogin(credential);
    } else if (!isNumeric && credential.length === 8) {
      handleLogin(credential);
    }
  }, [credential, loading, handleLogin]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (credential.length < 4) {
      toast.error('Enter at least 4 characters');
      return;
    }
    handleLogin(credential);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-dark via-gray-900 to-black dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10">
        <div className="absolute top-20 left-20 w-64 h-64 bg-brand-accent rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-brand-burgundy rounded-full blur-3xl"></div>
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-accent/10 dark:bg-amber-500/10 rounded-full mb-4">
              <span className="text-4xl">🍺</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-2">Bar Manager</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Enter your PIN or password</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <input
                type="password"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="6‑digit PIN or 8‑char password"
                className="w-full px-4 py-4 text-center text-xl border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/20 outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                autoFocus
                disabled={loading}
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                {/^\d+$/.test(credential)
                  ? 'Using PIN – 6 digits required'
                  : 'Using password – 8 characters required'}
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || credential.length < 4}
              className="w-full bg-brand-accent hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-lg shadow-lg shadow-amber-500/30"
            >
              {loading ? 'Verifying...' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
