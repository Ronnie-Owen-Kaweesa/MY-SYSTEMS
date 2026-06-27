import supabase from './supabaseClient';
import offlineDB from './offlineDB';

// Login with PIN
export async function loginWithPin(pinCode) {
    try {
        // Query users table for matching PIN
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('pin_code', pinCode)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            throw new Error('Invalid PIN');
        }

        // Store user in localStorage
        const userData = {
            id: data.id,
            name: data.full_name,
            role: data.role,
            phone: data.phone_number,
        };

        localStorage.setItem('bar_user', JSON.stringify(userData));
        localStorage.setItem('bar_token', data.id); // Simple token

        return { user: userData, error: null };
    } catch (error) {
        return { user: null, error: error.message };
    }
}

// Logout
export function logout() {
    localStorage.removeItem('bar_user');
    localStorage.removeItem('bar_token');
}

// Get current user
export function getCurrentUser() {
    const userStr = localStorage.getItem('bar_user');
    if (!userStr) return null;
    
    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}

// Check if authenticated
export function isAuthenticated() {
    return !!getCurrentUser();
}

// Get user role
export function getUserRole() {
    const user = getCurrentUser();
    return user ? user.role : null;
}

// Check if user is owner
export function isOwner() {
    return getUserRole() === 'owner';
}

// Check if user is cashier
export function isCashier() {
    return getUserRole() === 'cashier';
}
