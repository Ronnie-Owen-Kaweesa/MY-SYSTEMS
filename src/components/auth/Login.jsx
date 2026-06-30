import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { isOnline } from '../../services/offlineDB';
import toast from 'react-hot-toast';

export default function Login() {
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    } else if (!isOnline()) {
      setShowOfflineMessage(true);
    }
  }, [user, navigate]);

  const handleLogin = useCallback(async (input) => {
    setLoading(true);
    try {
      await login(input);
      toast.success('Welcome!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Login failed');
      setCredential('');
      if (!isOnline()) {
        setShowOfflineMessage(true);
      }
    } finally {
      setLoading(false);
    }
  }, [login, navigate]);

  useEffect(() => {
    if (loading) return;
    const isNumeric = /^\d+$/.test(credential);
    if (isNumeric && credential.length === 6) handleLogin(credential);
    else if (!isNumeric && credential.length === 8) handleLogin(credential);
  }, [credential, loading, handleLogin]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (credential.length < 4) {
      toast.error('Enter at least 4 characters');
      return;
    }
    handleLogin(credential);
  };

  // Generate random leaf positions
  const leaves = Array.from({ length: 25 }, (_, i) => ({
    id: i,
    top: Math.random() * 100,
    left: Math.random() * 100,
    size: Math.random() * 2 + 0.8,
    opacity: Math.random() * 0.3 + 0.1,
    delay: Math.random() * 3,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-brown via-brand-brown/90 to-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Floating leaves background */}
      <div className="absolute inset-0 pointer-events-none">
        {leaves.map((leaf) => (
          <span
            key={leaf.id}
            className="absolute animate-pulse"
            style={{
              top: `${leaf.top}%`,
              left: `${leaf.left}%`,
              fontSize: `${leaf.size}rem`,
              opacity: leaf.opacity,
              animationDelay: `${leaf.delay}s`,
            }}
          >
            🍃
          </span>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-green/10 dark:bg-green-500/10 rounded-full mb-4">
              <span className="text-4xl">🍺</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-brand-brown dark:text-white mb-2">Omuka Bar</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Enter your PIN or password</p>
          </div>

          {showOfflineMessage && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4 text-center">
              <p className="text-yellow-800 dark:text-yellow-300 font-medium">
                ⚠️ You are offline and no previous session was found.
              </p>
              <p className="text-yellow-700 dark:text-yellow-400 text-sm mt-1">
                Please connect to the internet once to log in. Afterwards you can work offline.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={credential}
              onChange={(e) => { setCredential(e.target.value); setShowOfflineMessage(false); }}
              placeholder="Enter your PIN or password"
              className="w-full px-4 py-4 text-center text-xl border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-brand-green focus:ring-4 focus:ring-brand-green/20 outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-6"
              autoFocus
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || credential.length < 4}
              className="w-full bg-brand-green hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-lg shadow-lg shadow-green-500/30 mb-3"
            >
              {loading ? 'Verifying...' : 'Enter'}
            </button>
            {!isOnline() && (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Connect to the internet and try again.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
