/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NavLink } from 'react-router';
import { 
  LayoutDashboard, 
  Package, 
  ArrowLeftRight, 
  Users, 
  Truck, 
  FileText, 
  Settings,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { lang, setLang } = useLang();
  const { profile } = useAuth();

  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';

  const menuItems = [
    { icon: LayoutDashboard, label: lang === 'FR' ? 'Tableau de bord' : 'Dashboard', path: '/dashboard' },
    { icon: Package, label: lang === 'FR' ? 'Inventaire' : 'Inventory', path: '/inventory' },
    { icon: ArrowLeftRight, label: lang === 'FR' ? 'Mouvements' : 'Movements', path: '/movements' },
    { icon: Users, label: lang === 'FR' ? 'Clients' : 'Clients', path: '/clients' },
    { icon: Truck, label: lang === 'FR' ? 'Fournisseurs' : 'Suppliers', path: '/suppliers' },
    { icon: FileText, label: lang === 'FR' ? 'Rapports' : 'Reports', path: '/reports' },
    ...(profile?.role === 'SUPER_ADMIN' || profile?.role === 'DG' || profile?.role === 'CZ' || profile?.role === 'CT' || profile?.role === 'CC' || profile?.role === 'EMPLOYEE' 
      ? [{ icon: Users, label: lang === 'FR' ? 'Utilisateurs' : 'Users', path: '/users' }] 
      : []),
    { icon: Settings, label: lang === 'FR' ? 'Paramètres' : 'Settings', path: '/settings' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <div className={cn(
        "fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 z-50 transition-transform duration-300 transform",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 border-b border-slate-800">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">StockMaster</div>
          <h1 className="text-lg font-bold text-white leading-tight">Global Institute<br />Management</h1>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => window.innerWidth < 1024 && onClose()}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm font-medium",
                isActive 
                  ? "bg-blue-600 text-white" 
                  : "hover:bg-slate-800 text-slate-400 hover:text-white"
              )}
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="text-[10px] text-slate-500 font-mono">v2.4.0-Enterprise</div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button 
              onClick={() => setLang('FR')}
              className={cn(
                "px-1.5 py-0.5 rounded border border-slate-700 transition-all active:scale-95", 
                lang === 'FR' ? "bg-slate-800 text-white border-blue-500" : "hover:bg-slate-800"
              )}
            >
              FR
            </button>
            <button 
              onClick={() => setLang('EN')}
              className={cn(
                "px-1.5 py-0.5 rounded border border-slate-700 transition-all active:scale-95", 
                lang === 'EN' ? "bg-slate-800 text-white border-blue-500" : "hover:bg-slate-800"
              )}
            >
              EN
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-bold uppercase tracking-tighter">Live</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
