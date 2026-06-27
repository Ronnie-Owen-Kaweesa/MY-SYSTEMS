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
  { path: '/settings', label: 'Settings', icon: '⚙️', roles: ['owner'] },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();

  const filteredMenu = menuItems.filter(item => 
    item.roles.includes(user?.role)
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`
        fixed top-0 left-0 h-full w-72 bg-gradient-to-b from-brand-dark to-gray-900 text-white z-30 transform transition-transform duration-300 ease-in-out shadow-2xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-0
      `}>
        <div className="p-6 border-b border-white/10">
          <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">
            🍺 Bar Manager
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <p className="text-gray-400 text-sm capitalize">{user?.role}</p>
          </div>
        </div>

        <nav className="mt-6 px-3">
          {filteredMenu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center px-4 py-3 mb-1 rounded-xl text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-200
                ${isActive ? 'bg-white/15 text-white font-medium shadow-lg shadow-black/10' : ''}
              `}
            >
              <span className="mr-3 text-xl">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center text-white font-bold">
              {user?.name?.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
