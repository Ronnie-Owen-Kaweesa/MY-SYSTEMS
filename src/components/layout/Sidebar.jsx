import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['owner', 'cashier'] },
  { path: '/products', label: 'Products', icon: '🍾', roles: ['owner'] },
  { path: '/inventory', label: 'Inventory', icon: '📦', roles: ['owner'] },
  { path: '/shifts', label: 'Shifts', icon: '🕐', roles: ['owner', 'cashier'] },
  { path: '/sales', label: 'Sales', icon: '💰', roles: ['owner', 'cashier'] },
  { path: '/reports', label: 'Reports', icon: '📈', roles: ['owner'] },
  { path: '/receipts', label: 'Receipts', icon: '🧾', roles: ['owner'] },
  { path: '/debts', label: 'Debts', icon: '💳', roles: ['owner'] },
  { path: '/settings', label: 'Settings', icon: '⚙️', roles: ['owner'] },
];

export default function Sidebar({ isOpen, onClose, collapsed }) {
  const { user } = useAuth();
  const filteredMenu = menuItems.filter(item => item.roles.includes(user?.role));

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full bg-gray-900 text-white z-30 transform transition-all duration-300 ease-in-out shadow-2xl flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-0
          ${collapsed ? 'w-20' : 'w-72'}
        `}
      >
        <div className={`p-6 border-b border-gray-700 ${collapsed ? 'text-center' : ''}`}>
          <h1 className={`font-display text-2xl font-bold bg-gradient-to-r from-brand-yellow to-brand-green bg-clip-text text-transparent ${collapsed ? 'hidden' : ''}`}>
            🍺 Omuka Bar
          </h1>
          <div className="flex items-center gap-2 mt-2 justify-center">
            <span className="w-2 h-2 bg-brand-green rounded-full animate-pulse"></span>
            <p className={`text-gray-400 text-sm capitalize ${collapsed ? 'hidden' : ''}`}>{user?.role}</p>
          </div>
        </div>

        <nav className={`flex-1 overflow-y-auto px-3 py-6 ${collapsed ? 'px-2' : ''}`}>
          {filteredMenu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 mb-1 rounded-xl text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-200
                ${isActive ? 'bg-brand-green/20 text-white font-medium shadow-lg shadow-green-500/10 border-l-2 border-brand-green' : ''}`
              }
              title={collapsed ? item.label : ''}
            >
              <span className="text-xl">{item.icon}</span>
              <span className={`ml-3 text-sm font-medium ${collapsed ? 'hidden' : ''}`}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={`p-6 border-t border-gray-700 ${collapsed ? 'flex justify-center' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-green flex items-center justify-center text-white font-bold">
              {user?.name?.charAt(0)}
            </div>
            <div className={`${collapsed ? 'hidden' : ''}`}>
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
