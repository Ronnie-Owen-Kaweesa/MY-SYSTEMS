import { supabase } from './supabaseClient';
import { isOnline, getCachedUserByPin, getCachedUserByPassword } from './offlineDB';

export async function loginUser(credential) {
  const isNumeric = /^\d+$/.test(credential);

  if (!isOnline()) {
    // Offline – verify against local cache
    if (isNumeric) {
      const user = await getCachedUserByPin(credential);
      if (!user) throw new Error('Invalid PIN or password');
      return { id: user.id, name: user.full_name, role: user.role };
    } else {
      const user = await getCachedUserByPassword(credential);
      if (!user) throw new Error('Invalid PIN or password');
      return { id: user.id, name: user.full_name, role: user.role };
    }
  }

  // Online – normal Supabase verification
  if (isNumeric) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('pin_code', credential)
      .eq('is_active', true)
      .single();
    if (error || !data) throw new Error('Invalid PIN or password');
    return { id: data.id, name: data.full_name, role: data.role };
  } else {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true);
    if (error) throw new Error('Login failed');
    for (const user of users) {
      if (user.password && user.password === credential) {
        return { id: user.id, name: user.full_name, role: user.role };
      }
    }
    throw new Error('Invalid PIN or password');
  }
}

export function logout() {
  localStorage.removeItem('bar_user');
}

export function getCurrentUser() {
  const userStr = localStorage.getItem('bar_user');
  if (!userStr) return null;
  try { return JSON.parse(userStr); } catch { return null; }
}
