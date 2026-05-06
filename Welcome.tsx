/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { Package, ArrowRight, Shield, BarChart3, Users } from 'lucide-react';
import { useLang } from '../contexts/LangContext';

export default function Welcome() {
  const navigate = useNavigate();
  const { lang } = useLang();

  const t = {
    title: lang === 'FR' ? 'Maîtrisez votre Stock avec StockMaster' : 'Master your Stock with StockMaster',
    subtitle: lang === 'FR' ? 'Solution professionnelle pour Global Institute Management' : 'Professional solution for Global Institute Management',
    button: lang === 'FR' ? 'Commencer' : 'Get Started',
    feature1: lang === 'FR' ? 'Suivi Temps Réel' : 'Real-time Tracking',
    feature2: lang === 'FR' ? 'Analyses Avancées' : 'Advanced Analytics',
    feature3: lang === 'FR' ? 'Gestion d\'Équipe' : 'Team Management',
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Floating Elements */}
      <motion.div 
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-[10%] opacity-20 dark:opacity-10"
      >
        <Package size={120} className="text-blue-600" />
      </motion.div>
      <motion.div 
        animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-20 right-[10%] opacity-20 dark:opacity-10"
      >
        <BarChart3 size={120} className="text-indigo-600" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 text-center space-y-8 max-w-3xl"
      >
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl">
            <Package size={48} className="text-blue-600" />
          </div>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white">
          Stock<span className="text-blue-600">Master</span>
        </h1>
        
        <p className="text-xl text-slate-600 dark:text-slate-400 font-medium max-w-2xl mx-auto">
          {t.subtitle}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12">
          <FeatureCard icon={<Shield className="text-blue-500" />} text={t.feature1} />
          <FeatureCard icon={<BarChart3 className="text-indigo-500" />} text={t.feature2} />
          <FeatureCard icon={<Users className="text-purple-500" />} text={t.feature3} />
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/login')}
          className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-lg shadow-xl hover:shadow-blue-500/25 flex items-center gap-3 mx-auto transition-all"
        >
          {t.button} <ArrowRight size={20} />
        </motion.button>
      </motion.div>

      <footer className="absolute bottom-8 text-slate-400 dark:text-slate-600 text-sm font-medium">
        © 2024 Global Institute Management
      </footer>
    </div>
  );
}

function FeatureCard({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="p-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20 dark:border-slate-700/50"
    >
      <div className="mb-3 flex justify-center">{icon}</div>
      <p className="font-semibold text-slate-800 dark:text-slate-200">{text}</p>
    </motion.div>
  );
}
