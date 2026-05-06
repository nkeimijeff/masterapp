/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Menu, Sun, Moon, LogOut, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLang } from '../contexts/LangContext';
import { useNavigate } from 'react-router';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang } = useLang();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors px-4 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="p-2 text-slate-500 hover:bg-slate-50 lg:hidden">
          <Menu size={20} />
        </button>
        <span className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Stockmaster</span>
        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2 hidden sm:block"></div>
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder={lang === 'FR' ? 'Rechercher un article...' : 'Search...'}
            className="w-64 pl-9 pr-4 py-1.5 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-xs focus:ring-2 focus:ring-blue-500 outline-hidden transition-all dark:text-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button 
            onClick={() => theme !== 'light' && toggleTheme()}
            className={cn(
              "px-3 py-1 text-[10px] font-black tracking-widest rounded-md transition-all cursor-pointer", 
              theme === 'light' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-300"
            )}
          >
            CLAIR
          </button>
          <button 
            onClick={() => theme !== 'dark' && toggleTheme()}
            className={cn(
              "px-3 py-1 text-[10px] font-black tracking-widest rounded-md transition-all cursor-pointer", 
              theme === 'dark' ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            SOMBRE
          </button>
        </div>

        <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-slate-200 dark:border-slate-800">
          <div className="text-right hidden xs:block">
            <div className="text-xs font-bold dark:text-white leading-none mb-0.5">{profile?.name}</div>
            <div className="text-[10px] text-blue-600 uppercase font-black tracking-wider leading-none">{profile?.role}</div>
          </div>
          <div className="relative group cursor-help">
            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden font-bold text-slate-600 dark:text-slate-400 text-sm shadow-sm group-hover:scale-105 transition-transform duration-200">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                profile?.name?.substring(0, 2).toUpperCase()
              )}
            </div>
            
            {/* Profile Hover Card */}
            <div className="absolute top-[120%] right-0 w-64 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform group-hover:translate-y-1 z-50 pointer-events-none">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/10 text-blue-600 flex items-center justify-center font-black">
                  {profile?.name?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold dark:text-white leading-none">{profile?.name}</p>
                  <p className="text-[10px] text-blue-600 uppercase font-black tracking-widest mt-1">{profile?.role}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Email Professionnel</span>
                  <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 break-all">{profile?.email}</p>
                </div>
                {profile?.phone && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Contact</span>
                    <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300">{profile?.phone}</p>
                  </div>
                )}
                <div className="pt-3 border-t border-slate-50 dark:border-slate-800">
                  <p className="text-[8px] italic text-slate-400">GIM - Global Institute Management System</p>
                </div>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
