import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { loginUser, logout as authLogout, getCurrentUser } from '../services/authService';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimer = useRef(null);

  useEffect(() => {
    const storedUser = getCurrentUser();
    if (storedUser && storedUser.expiresAt && new Date(storedUser.expiresAt) > new Date()) {
      setUser(storedUser);
    } else {
      authLogout();
    }
    setLoading(false);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      authLogout();
      setUser(null);
      toast.error('Logged out due to inactivity');
    }, INACTIVITY_TIMEOUT);
  }, []);

  useEffect(() => {
    if (!user) return;
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetInactivityTimer));
    resetInactivityTimer();
    return () => {
      events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user, resetInactivityTimer]);

  const login = async (credential) => {
    const userData = await loginUser(credential);
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const fullUser = { ...userData, expiresAt };
    localStorage.setItem('bar_user', JSON.stringify(fullUser));
    setUser(fullUser);
    return fullUser;
  };

  const logout = () => {
    authLogout();
    setUser(null);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
  };

  const value = {
    user,
    login,
    logout,
    isOwner: user?.role === 'owner',
    isCashier: user?.role === 'cashier',
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
