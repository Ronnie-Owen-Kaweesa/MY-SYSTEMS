import supabase from './supabaseClient';

// Login with either PIN or password
export async function loginUser(credential) {
  try {
    const isNumeric = /^\d+$/.test(credential);

    if (isNumeric) {
      // Try PIN
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('pin_code', credential)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        throw new Error('Invalid PIN or password');
      }
      return {
        id: data.id,
        name: data.full_name,
        role: data.role,
        phone: data.phone_number,
      };
    } else {
      // Try password
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('password', credential)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        throw new Error('Invalid PIN or password');
      }
      return {
        id: data.id,
        name: data.full_name,
        role: data.role,
        phone: data.phone_number,
      };
    }
  } catch (error) {
    throw new Error(error.message);
  }
}

// Owner can set a password for any user
export async function setUserPassword(userId, newPassword) {
  const { error } = await supabase
    .from('users')
    .update({ password: newPassword })
    .eq('id', userId);
  if (error) throw error;
}

export function logout() {
  localStorage.removeItem('bar_user');
}

export function getCurrentUser() {
  const userStr = localStorage.getItem('bar_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}
