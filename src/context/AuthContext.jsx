import React, { createContext, useState, useContext, useEffect } from 'react';
import { loginWithPin, logout as authLogout, getCurrentUser } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setLoading(false);
  }, []);

  const login = async (pin) => {
    const { user: userData, error } = await loginWithPin(pin);
    if (error) throw new Error(error);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    authLogout();
    setUser(null);
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
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
