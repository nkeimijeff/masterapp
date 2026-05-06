/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileDown, 
  Mail,
  Calendar, 
  Package, 
  Truck, 
  Users, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  BarChart3,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  TrendingUp,
  Download
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, StockMovement, Client, Supplier } from '../types';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, cn } from '../lib/utils';
import { StatCard } from '../components/StatCard';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';

export default function Reports() {
  const { lang } = useLang();
  const { profile } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState<'day' | 'month' | 'year' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showProductActions, setShowProductActions] = useState(false);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const unsubMovements = onSnapshot(query(collection(db, 'movements'), orderBy('createdAt', 'desc')), (snapshot) => {
      setMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockMovement)));
      setLoading(false);
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });

    return () => {
      unsubProducts();
      unsubMovements();
      unsubClients();
      unsubSuppliers();
    };
  }, []);

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const mDate = new Date(m.createdAt);
      if (period === 'day') {
        const targetDate = new Date(selectedDate);
        return mDate.toDateString() === targetDate.toDateString();
      }
      if (period === 'month') {
        return mDate.getMonth() === selectedMonth && mDate.getFullYear() === selectedYear;
      }
      if (period === 'year') {
        return mDate.getFullYear() === selectedYear;
      }
      return true;
    });
  }, [movements, period, selectedDate, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    const totalStockVal = products.reduce((acc, p) => acc + (p.quantity * p.buyPrice), 0);
    const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= p.alertLevel).length;
    const outOfStock = products.filter(p => p.quantity <= 0).length;
    
    return {
      totalProducts: products.length,
      totalSuppliers: suppliers.length,
      totalClients: clients.length,
      totalMovements: filteredMovements.length,
      stockValue: totalStockVal,
      lowStock,
      outOfStock
    };
  }, [products, suppliers, clients, filteredMovements]);

  const productReportData = useMemo(() => {
    return products.map(p => {
      const inQty = movements
        .filter(m => m.type === 'IN')
        .reduce((acc, m) => {
          const items = Array.isArray(m.items) ? m.items : [];
          const item = items.find(it => it.productId === p.id);
          return acc + (item?.quantity || 0);
        }, 0);
      
      const outQty = movements
        .filter(m => m.type === 'OUT')
        .reduce((acc, m) => {
          const items = Array.isArray(m.items) ? m.items : [];
          const item = items.find(it => it.productId === p.id);
          return acc + (item?.quantity || 0);
        }, 0);

      return {
        ...p,
        totalIn: inQty,
        totalOut: outQty
      };
    });
  }, [products, movements]);

  const supplierReportData = useMemo(() => {
    return suppliers.map(s => {
      const movCount = movements.filter(m => m.actorId === s.id).length;
      return { ...s, movCount };
    });
  }, [suppliers, movements]);

  const clientReportData = useMemo(() => {
    return clients.map(c => {
      const clientMovs = movements.filter(m => m.actorId === c.id);
      const uniqueProducts = new Set();
      clientMovs.forEach(m => {
        const items = Array.isArray(m.items) ? m.items : [];
        items.forEach(it => uniqueProducts.add(it.productId));
      });
      return { ...c, orderedCount: uniqueProducts.size };
    });
  }, [clients, movements]);

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(20);
    doc.text("GIM - Rapport Analytique Global", 14, 20);
    doc.setFontSize(10);
    doc.text(`Période: ${period.toUpperCase()} - Date: ${new Date().toLocaleDateString()}`, 14, 28);

    // Summary
    autoTable(doc, {
      startY: 35,
      head: [['Indicateur', 'Valeur']],
      body: [
        ['Total Articles', stats.totalProducts],
        ['Total Fournisseurs', stats.totalSuppliers],
        ['Total Clients', stats.totalClients],
        ['Valeur Stock Total', formatCurrency(stats.stockValue)],
        ['Articles en Alerte', stats.lowStock],
        ['Articles en Rupture', stats.outOfStock]
      ],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.addPage();
    doc.text("Détails des Produits", 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [['Nom', 'Stock', 'P. Achat', 'P. Vente', 'Entrées Totales', 'Sorties Totales', 'Statut', 'Fournisseur']],
      body: productReportData.map(p => [
        p.name, 
        p.quantity, 
        formatCurrency(p.buyPrice), 
        formatCurrency(p.sellPrice),
        p.totalIn,
        p.totalOut,
        p.status,
        p.supplierName
      ]),
      theme: 'grid'
    });

    doc.save(`rapport_gim_${Date.now()}.pdf`);
    toast.success("Rapport PDF généré !");
  };

  const sendMailReport = () => {
    if (!profile?.email) return;
    const subject = encodeURIComponent(`Rapport GIM - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(`
Rapport Analytique Global GIM
Date: ${new Date().toLocaleDateString()}
Période: ${period}

Total Articles: ${stats.totalProducts}
Valeur Stock Total: ${formatCurrency(stats.stockValue)}
Articles en Alerte: ${stats.lowStock}
Articles en Rupture: ${stats.outOfStock}

Consultez le portail: ${window.location.origin}
    `.trim());
    window.location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`;
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-600" size={48} />
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
            {lang === 'FR' ? 'Rapports Généraux' : 'General Reports'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Analyses approfondies de votre inventaire et flux</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period Selection */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-2xl shadow-sm">
              {(['day', 'month', 'year', 'all'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    period === p 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {lang === 'FR' ? (p === 'day' ? 'Jour' : p === 'month' ? 'Mois' : p === 'year' ? 'An' : 'Tout') : p}
                </button>
              ))}
            </div>

            {/* Specific Selectors */}
            {period === 'day' && (
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono outline-hidden focus:ring-2 focus:ring-blue-500/30"
              />
            )}
            {period === 'month' && (
              <div className="flex gap-2">
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-hidden focus:ring-2 focus:ring-blue-500/30"
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i} value={i}>{new Date(0, i).toLocaleString(lang === 'FR' ? 'fr-FR' : 'en-US', { month: 'long' })}</option>
                  ))}
                </select>
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-hidden focus:ring-2 focus:ring-blue-500/30"
                >
                  {[2023, 2024, 2025, 2026].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}
            {period === 'year' && (
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-hidden focus:ring-2 focus:ring-blue-500/30"
              >
                {[2023, 2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2">
            <button 
              onClick={sendMailReport}
              className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest text-[10px] hover:border-blue-500 transition-all shadow-sm"
            >
              <Mail size={16} className="text-blue-600" />
            </button>
            <button 
              onClick={exportPDF}
              className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest text-[10px] hover:border-blue-500 transition-all shadow-sm"
            >
              <Download size={16} className="text-blue-600" />
              Exporter PDF
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard icon={<Package size={16} />} label="Total Articles" value={stats.totalProducts.toString()} color="blue" />
        <StatCard icon={<Truck size={16} />} label="Fournisseurs" value={stats.totalSuppliers.toString()} color="emerald" />
        <StatCard icon={<Users size={16} />} label="Clients" value={stats.totalClients.toString()} color="indigo" />
        <StatCard icon={<BarChart3 size={16} />} label="Mouvements Période" value={stats.totalMovements.toString()} color="amber" />
        <StatCard icon={<TrendingUp size={16} />} label="Valeur Stock Total" value={formatCurrency(stats.stockValue)} color="emerald" />
        <StatCard icon={<AlertTriangle size={16} />} label="Alertes Stock" value={stats.lowStock.toString()} color="rose" />
        <StatCard icon={<XCircle size={16} />} label="Ruptures" value={stats.outOfStock.toString()} color="rose" />
      </div>

      {/* Search & Options */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher dans les rapports..."
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-hidden focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actions sur produits</span>
          <button 
            onClick={() => setShowProductActions(!showProductActions)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              showProductActions ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-800"
            )}
          >
            <span className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
              showProductActions ? "translate-x-6" : "translate-x-1"
            )} />
          </button>
        </div>
      </div>

      {/* TABLE 1: PRODUCTS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight dark:text-white flex items-center gap-2">
            <Package size={20} className="text-blue-600" />
            Rapport des Articles
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4">Produit</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">P. Achat</th>
                <th className="px-6 py-4">P. Vente</th>
                <th className="px-6 py-4">Entrées Tot.</th>
                <th className="px-6 py-4">Sorties Tot.</th>
                <th className="px-6 py-4 text-center">Statut</th>
                <th className="px-6 py-4">Fournisseur</th>
                {showProductActions && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {productReportData.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <Package size={20} className="text-slate-400" />}
                      </div>
                      <span className="font-bold text-sm dark:text-white">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-xs dark:text-white">{p.quantity}</td>
                  <td className="px-6 py-4 text-xs font-medium dark:text-slate-300">{formatCurrency(p.buyPrice)}</td>
                  <td className="px-6 py-4 text-xs font-bold dark:text-white">{formatCurrency(p.sellPrice)}</td>
                  <td className="px-6 py-4">
                    <span className="text-emerald-500 font-bold text-xs">+{p.totalIn}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-rose-500 font-bold text-xs">-{p.totalOut}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{p.supplierName}</span>
                  </td>
                  {showProductActions && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <button className="p-2 text-slate-400 hover:text-blue-600 rounded-full transition-colors"><Eye size={16} /></button>
                        <button className="p-2 text-slate-400 hover:text-emerald-600 rounded-full transition-colors"><Edit size={16} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* TABLE 2: SUPPLIERS */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden h-fit">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-black uppercase tracking-tight dark:text-white flex items-center gap-2">
              <Truck size={20} className="text-emerald-600" />
              Fournisseurs Actifs
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="px-6 py-4">Fournisseur</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Date Ajout</th>
                  <th className="px-6 py-4 text-center">Mouvements</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {supplierReportData.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center overflow-hidden">
                          {s.photoURL ? <img src={s.photoURL} alt={s.name} className="w-full h-full object-cover" /> : <Users size={14} />}
                        </div>
                        <span className="text-xs font-bold dark:text-white">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">{s.email}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded text-xs">{s.movCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLE 3: CLIENTS */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden h-fit">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-black uppercase tracking-tight dark:text-white flex items-center gap-2">
              <Users size={20} className="text-indigo-600" />
              Portefeuille Clients
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4 text-center">Art. Commandés</th>
                  <th className="px-6 py-4">Téléphone</th>
                  <th className="px-6 py-4">Localisation</th>
                  <th className="px-6 py-4">Date Ajout</th>
                  <th className="px-6 py-4">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {clientReportData.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 flex items-center justify-center overflow-hidden">
                          {c.photoURL ? <img src={c.photoURL} alt={c.name} className="w-full h-full object-cover" /> : <Users size={14} />}
                        </div>
                        <span className="text-xs font-bold dark:text-white">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 px-2 py-1 rounded-lg">{c.orderedCount}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">{c.phone}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{c.location}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-black tracking-tighter uppercase">
                        <CheckCircle size={10} /> Actif
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* TABLE 4: MOVEMENTS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-black uppercase tracking-tight dark:text-white flex items-center gap-2">
            <ArrowUpCircle size={20} className="text-amber-600" />
            Flux de Mouvements Historiques
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4">Date & Heure</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Concerne</th>
                <th className="px-6 py-4">Détails (Articles)</th>
                <th className="px-6 py-4">Nombre Tot.</th>
                <th className="px-6 py-4">Prix Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filteredMovements.slice(0, 15).map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold dark:text-white">{new Date(m.createdAt).toLocaleDateString()}</p>
                    <p className="text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleTimeString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      m.type === 'IN' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                      {m.type === 'IN' ? 'Entrée' : 'Vente / Sortie'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold dark:text-slate-200">{m.actorName}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(m.items) ? m.items : []).map((it, i) => (
                        <span key={i} className="text-[9px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-bold">
                          {it.productName} ({it.quantity})
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-xs dark:text-white">{m.totalItems}</td>
                  <td className="px-6 py-4 font-black text-slate-800 dark:text-white">{formatCurrency(m.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Product['status'] }) {
  const styles = {
    available: "bg-emerald-50 text-emerald-600 border-emerald-100",
    low: "bg-amber-50 text-amber-600 border-amber-100",
    out_of_stock: "bg-rose-50 text-rose-600 border-rose-100",
  };

  const labels = {
    available: "En Stock",
    low: "Alerte",
    out_of_stock: "Rupture",
  };

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-1",
      styles[status]
    )}>
      <div className={cn("w-1.5 h-1.5 rounded-full", status === 'available' ? 'bg-emerald-500' : status === 'low' ? 'bg-amber-500' : 'bg-rose-500')} />
      {labels[status]}
    </span>
  );
}
