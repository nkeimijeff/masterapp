/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { Package, Sun, Moon, Languages, Mail, Lock, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

// Login page for Global Institute Management
export default function Login() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang } = useLang();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const t = {
    title: lang === 'FR' ? 'Connexion' : 'Login',
    email: lang === 'FR' ? 'Adresse Email' : 'Email Address',
    password: lang === 'FR' ? 'Mot de Passe' : 'Password',
    terms: lang === 'FR' ? 'J\'accepte les politiques et les règles de l\'entreprise GIM' : 'I accept the policies and rules of GIM',
    button: lang === 'FR' ? 'Se Connecter' : 'Sign In',
    errorTerms: lang === 'FR' ? 'Veuillez accepter les conditions' : 'Please accept terms',
    errorAuth: lang === 'FR' ? 'Identifiants invalides' : 'Invalid credentials',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast.error(t.errorTerms);
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      toast.success(lang === 'FR' ? 'Bienvenue !' : 'Welcome!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(t.errorAuth);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 relative transition-colors duration-300">
      {/* Controls */}
      <div className="absolute top-8 right-8 flex gap-4">
        <button
          onClick={() => setLang(lang === 'FR' ? 'EN' : 'FR')}
          className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-medium"
        >
          <Languages size={18} /> {lang}
        </button>
        <button
          onClick={toggleTheme}
          className="p-2 bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-8 pb-4 text-center">
            <div className="inline-flex p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl mb-4 text-blue-600">
              <Package size={32} />
            </div>
            <h1 className="text-3xl font-bold dark:text-white">StockMaster</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Global Institute Management</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">{t.email}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@gim-edu.com"
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">{t.password}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 ml-1">
              <input
                id="terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
              />
              <label htmlFor="terms" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                {t.terms}
              </label>
            </div>

            <button
              disabled={isLoading}
              type="submit"
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : t.button}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
