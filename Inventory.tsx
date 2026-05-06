/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Plus, 
  Search, 
  Filter, 
  FileDown, 
  Mail, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Package,
  ArrowUpDown,
  X,
  Camera,
  Loader2,
  Trash,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  query,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import { formatCurrency, formatNumber, cn } from '../lib/utils';
import { StatCard } from '../components/StatCard';
import { toast } from 'sonner';

export default function Inventory() {
  const { lang } = useLang();
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState<'day' | 'month' | 'year' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form State
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    quantity: 0,
    buyPrice: 0,
    sellPrice: 0,
    alertLevel: 0,
    supplierName: '',
    description: '',
    imageUrl: ''
  });

  const [suppliers, setSuppliers] = useState<any[]>([]);

  const canManage = profile?.role === 'SUPER_ADMIN' || profile?.role === 'DG' || profile?.role === 'CZ' || profile?.role === 'CT' || profile?.role === 'CC' || profile?.role === 'EMPLOYEE';
  const canDelete = profile?.role === 'SUPER_ADMIN' || profile?.role === 'DG' || profile?.role === 'CZ' || profile?.role === 'CT';

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        setLoading(false);
      },
      (error) => {
        console.error("Inventory fetch error:", error);
        toast.error(lang === 'FR' ? "Erreur d'accès aux données" : "Data access error");
        setLoading(false);
      }
    );

    const unsubscribeSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    return () => {
      unsubscribe();
      unsubscribeSuppliers();
    };
  }, [lang]);

  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'low' | 'out_of_stock'>('all');

  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      
      const pDate = new Date(p.createdAt);
      let matchesPeriod = true;
      if (period === 'day') {
        const targetDate = new Date(selectedDate);
        matchesPeriod = pDate.toDateString() === targetDate.toDateString();
      } else if (period === 'month') {
        matchesPeriod = pDate.getMonth() === selectedMonth && pDate.getFullYear() === selectedYear;
      } else if (period === 'year') {
        matchesPeriod = pDate.getFullYear() === selectedYear;
      }

      return matchesSearch && matchesStatus && matchesPeriod;
    });

    return result.sort((a, b) => {
      const factor = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'name') return factor * a.name.localeCompare(b.name);
      if (sortBy === 'quantity') return factor * (a.quantity - b.quantity);
      if (sortBy === 'createdAt') return factor * ((a.createdAt || 0) - (b.createdAt || 0));
      return 0;
    });
  }, [products, searchTerm, statusFilter, sortBy, sortOrder, period, selectedDate, selectedMonth, selectedYear]);

  const toggleSort = (type: 'name' | 'quantity' | 'createdAt') => {
    if (sortBy === type) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder(type === 'name' ? 'asc' : 'desc');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (!canManage) {
      toast.error(lang === 'FR' ? 'Accès refusé' : 'Access denied');
      return;
    }
    try {
      const status = formData.quantity <= 0 ? 'out_of_stock' : formData.quantity <= formData.alertLevel ? 'low' : 'available';
      const data = {
        ...formData,
        updatedAt: Date.now(),
        status
      };

      if (isEditing) {
        await updateDoc(doc(db, 'products', isEditing), data);
        toast.success(lang === 'FR' ? 'Produit mis à jour !' : 'Product updated!');
      } else {
        await addDoc(collection(db, 'products'), {
          ...data,
          createdAt: Date.now()
        });
        
        toast.success(lang === 'FR' ? 'Produit ajouté !' : 'Product added!');
      }

      setIsModalOpen(false);
      setIsEditing(null);
      setFormData({
        name: '', quantity: 0, buyPrice: 0, sellPrice: 0, alertLevel: 0, supplierName: '', description: '', imageUrl: ''
      });
    } catch (error) {
      toast.error('Error saving product');
    }
  };

  const openEditModal = (product: Product) => {
    setIsEditing(product.id);
    setFormData({
      name: product.name,
      quantity: product.quantity,
      buyPrice: product.buyPrice,
      sellPrice: product.sellPrice,
      alertLevel: product.alertLevel,
      supplierName: product.supplierName,
      description: product.description || '',
      imageUrl: product.imageUrl || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      toast.error(lang === 'FR' ? "Accès refusé : Seuls les admins et DG peuvent supprimer" : "Access denied: Only admins and DG can delete");
      return;
    }
    if (!window.confirm(lang === 'FR' ? `Supprimer définitivement ce produit ?` : `Permanently delete this product?`)) return;
    setIsDeleting(id);
    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success(lang === 'FR' ? 'Produit supprimé avec succès' : 'Product deleted successfully');
    } catch (error: any) {
      console.error("Delete product error:", error);
      toast.error(lang === 'FR' ? 'Erreur lors de la suppression' : 'Error during deletion');
    } finally {
      setIsDeleting(null);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Global Institute Management", 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Rapport d'Inventaire - ${new Date().toLocaleDateString()}`, 14, 30);

    autoTable(doc, {
      startY: 40,
      head: [['Produit', 'Qté', 'PA', 'PV', 'Fournisseur']],
      body: products.map(p => [
        p.name,
        p.quantity.toString(),
        formatCurrency(p.buyPrice),
        formatCurrency(p.sellPrice),
        p.supplierName
      ]),
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      }
    });

    doc.save(`inventory_${Date.now()}.pdf`);
    toast.success('PDF Exporté');
  };

  const sendMailReport = () => {
    if (!profile?.email) return;
    const subject = encodeURIComponent(`Inventaire GIM - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(`
Rapport d'Inventaire Central
Date: ${new Date().toLocaleDateString()}

Total Articles: ${products.length}
Valeur Stock: ${formatCurrency(products.reduce((acc, p) => acc + (p.buyPrice * p.quantity), 0))}
Alertes Stock: ${products.filter(p => p.status === 'low').length}

Consultez le portail: ${window.location.origin}
    `.trim());
    window.location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Main Stats */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-8 bg-blue-600 rounded-full" />
            <h1 className="text-3xl font-black tracking-tight dark:text-white uppercase">
              {lang === 'FR' ? 'Inventaire Central' : 'Central Inventory'}
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium ml-4">
            {lang === 'FR' ? 'Suivi en temps réel et gestion des flux' : 'Real-time tracking and flow management'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-1 shadow-xs">
            <button 
              onClick={sendMailReport} 
              className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-all flex items-center gap-2 text-sm font-bold"
            >
              <Mail size={16} />
            </button>
            <button 
              onClick={exportPDF} 
              className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-all flex items-center gap-2 text-sm font-bold"
            >
              <FileDown size={16} />
              <span>PDF</span>
            </button>
          </div>

          <button 
            disabled={!canManage}
            onClick={() => {
              setIsEditing(null);
              setFormData({
                name: '', quantity: 0, buyPrice: 0, sellPrice: 0, alertLevel: 0, supplierName: '', description: '', imageUrl: ''
              });
              setIsModalOpen(true);
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 font-black uppercase tracking-widest text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            {lang === 'FR' ? 'Ajouter Produit' : 'Add Product'}
          </button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label={lang === 'FR' ? 'Total Articles' : 'Total Items'} 
          value={products.length.toString()} 
          icon={<Package />}
          color="blue"
        />
        <StatCard 
          label={lang === 'FR' ? 'Valeur Stock' : 'Stock Value'} 
          value={formatCurrency(products.reduce((acc, p) => acc + ((Number(p.buyPrice) || 0) * (Number(p.quantity) || 0)), 0))} 
          icon={<Package />}
          color="emerald"
        />
        <StatCard 
          label={lang === 'FR' ? 'Alerte Stock' : 'Low Stock'} 
          value={products.filter(p => p.status === 'low').length.toString()} 
          icon={<ArrowUpDown />}
          trend={products.filter(p => p.status === 'low').length > 0 ? (lang === 'FR' ? 'Alerte' : 'Alert') : undefined}
          isPositive={products.filter(p => p.status === 'low').length === 0}
          color="amber"
        />
        <StatCard 
          label={lang === 'FR' ? 'Rupture' : 'Stock Out'} 
          value={products.filter(p => p.status === 'out_of_stock').length.toString()} 
          icon={<X />}
          trend={products.filter(p => p.status === 'out_of_stock').length > 0 ? (lang === 'FR' ? 'Critique' : 'Critical') : undefined}
          isPositive={products.filter(p => p.status === 'out_of_stock').length === 0}
          color="rose"
        />
      </div>

      {/* Advanced Filter Bar */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-12 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={lang === 'FR' ? 'Rechercher par nom, fournisseur...' : 'Search by name, supplier...'}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm font-medium dark:text-white"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-2xl shadow-sm">
                {(['day', 'month', 'year', 'all'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      period === p 
                        ? "bg-blue-600 text-white shadow shadow-blue-500/20" 
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {lang === 'FR' ? (p === 'day' ? 'Jour' : p === 'month' ? 'Mois' : p === 'year' ? 'An' : 'Tout') : p}
                  </button>
                ))}
              </div>

              {period === 'day' && (
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono outline-hidden focus:ring-2 focus:ring-blue-500/30"
                />
              )}
              {period === 'month' && (
                <div className="flex gap-1">
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase outline-hidden focus:ring-2 focus:ring-blue-500/30"
                  >
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i} value={i}>{new Date(0, i).toLocaleString(lang === 'FR' ? 'fr-FR' : 'en-US', { month: 'short' })}</option>
                    ))}
                  </select>
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black outline-hidden focus:ring-2 focus:ring-blue-500/30"
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
                  className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black outline-hidden focus:ring-2 focus:ring-blue-500/30"
                >
                  {[2023, 2024, 2025, 2026].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="xl:col-span-12 flex flex-wrap gap-2">
            <button 
              onClick={() => toggleSort('name')}
              className={cn(
                "flex-1 md:flex-none px-6 py-3 bg-white dark:bg-slate-900 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm",
                sortBy === 'name' ? "border-blue-500 text-blue-600" : "border-slate-200 dark:border-slate-800 text-slate-400"
              )}
            >
              {lang === 'FR' ? 'Nom' : 'Name'} {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => toggleSort('quantity')}
              className={cn(
                "flex-1 md:flex-none px-6 py-3 bg-white dark:bg-slate-900 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm",
                sortBy === 'quantity' ? "border-blue-500 text-blue-600" : "border-slate-200 dark:border-slate-800 text-slate-400"
              )}
            >
              {lang === 'FR' ? 'Qté' : 'Qty'} {sortBy === 'quantity' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => toggleSort('createdAt')}
              className={cn(
                "flex-1 md:flex-none px-6 py-3 bg-white dark:bg-slate-900 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm",
                sortBy === 'createdAt' ? "border-blue-500 text-blue-600" : "border-slate-200 dark:border-slate-800 text-slate-400"
              )}
            >
              {lang === 'FR' ? 'Date' : 'Date'} {sortBy === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <FilterButton 
            active={statusFilter === 'all'} 
            onClick={() => setStatusFilter('all')}
            label={lang === 'FR' ? 'Tous' : 'All'}
            icon={<Package size={14} />}
          />
          <FilterButton 
            active={statusFilter === 'available'} 
            onClick={() => setStatusFilter('available')}
            label={lang === 'FR' ? 'En Stock' : 'Available'}
            color="emerald"
            icon={<CheckCircle size={14} />}
          />
          <FilterButton 
            active={statusFilter === 'low'} 
            onClick={() => setStatusFilter('low')}
            label={lang === 'FR' ? 'Alerte' : 'Alert'}
            color="amber"
            icon={<ArrowUpDown size={14} />}
          />
          <FilterButton 
            active={statusFilter === 'out_of_stock'} 
            onClick={() => setStatusFilter('out_of_stock')}
            label={lang === 'FR' ? 'Rupture' : 'Stock Out'}
            color="rose"
            icon={<X size={14} />}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="px-6 py-3">Produit</th>
                <th className="px-6 py-3">Quantité</th>
                <th className="px-6 py-3">P. Achat</th>
                <th className="px-6 py-3">P. Vente</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-blue-600 mx-auto" size={32} />
                  </td>
                </tr>
              ) : filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <Package size={16} className="text-slate-400" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{p.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{p.supplierName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-xs">
                    <span className="font-mono font-bold dark:text-white">{p.quantity}</span>
                  </td>
                  <td className="px-6 py-3 text-xs">
                    <span className="font-medium dark:text-slate-300">{formatCurrency(p.buyPrice)}</span>
                  </td>
                  <td className="px-6 py-3 text-xs">
                    <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(p.sellPrice)}</span>
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        disabled={!canManage}
                        onClick={() => openEditModal(p)}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          canManage ? "text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20" : "text-slate-200 cursor-not-allowed"
                        )}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(p.id)}
                        disabled={!canDelete || isDeleting === p.id}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          canDelete ? "text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" : "text-slate-200 cursor-not-allowed"
                        )}
                      >
                        {isDeleting === p.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h2 className="text-xl font-bold dark:text-white">
                  {isEditing ? (lang === 'FR' ? 'Modifier l\'Article' : 'Edit Article') : (lang === 'FR' ? 'Ajouter un Article' : 'Add New Article')}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="flex flex-col items-center mb-6">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-3xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-500">
                      {formData.imageUrl ? (
                        <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Camera size={32} />
                          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Photo</span>
                        </div>
                      )}
                    </div>
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/30 hover:scale-110 active:scale-95 transition-all"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setFormData({...formData, imageUrl: ev.target?.result as string});
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden" 
                  />
                  {formData.imageUrl && (
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, imageUrl: ''})}
                      className="mt-2 text-xs text-red-500 font-bold hover:underline"
                    >
                      Supprimer la photo
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField label="Nom de l'article" required>
                    <input 
                      required 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Ex: Ordinateur HP Elitebook" 
                      className="form-input" 
                    />
                  </FormField>
                  <FormField label="Fournisseur" required>
                    <select 
                      required 
                      value={formData.supplierName}
                      onChange={(e) => setFormData({...formData, supplierName: e.target.value})}
                      className="form-input"
                    >
                      <option value="">Sélectionner un fournisseur</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Quantité Initiale" required>
                    <input 
                      required 
                      type="number" 
                      value={formData.quantity}
                      onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                      className="form-input" 
                    />
                  </FormField>
                  <FormField label="Stock d'Alerte" required>
                    <input 
                      required 
                      type="number" 
                      value={formData.alertLevel}
                      onChange={(e) => setFormData({...formData, alertLevel: parseInt(e.target.value) || 0})}
                      className="form-input" 
                    />
                  </FormField>
                  <FormField label={lang === 'FR' ? "Prix d'Achat" : "Buy Price"} required>
                    <input 
                      required 
                      type="number" 
                      value={formData.buyPrice}
                      onChange={(e) => setFormData({...formData, buyPrice: parseInt(e.target.value) || 0})}
                      className="form-input" 
                    />
                  </FormField>
                  <FormField label={lang === 'FR' ? "Prix de Vente" : "Sell Price"} required>
                    <input 
                      required 
                      type="number" 
                      value={formData.sellPrice}
                      onChange={(e) => setFormData({...formData, sellPrice: parseInt(e.target.value) || 0})}
                      className="form-input" 
                    />
                  </FormField>
                </div>
                
                <FormField label="Description">
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="form-input min-h-[100px]" 
                  />
                </FormField>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 font-bold text-slate-500 hover:text-slate-700 transition-colors">
                    Annuler
                  </button>
                  <button type="submit" className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all">
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .form-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(248, 250, 252, 1);
          border: 1px solid rgba(226, 232, 240, 1);
          border-radius: 0.75rem;
          outline: none;
          transition: all 0.2s;
          font-weight: 500;
        }
        .dark .form-input {
          background: rgba(15, 23, 42, 1);
          border-color: rgba(30, 41, 59, 1);
          color: white;
        }
        .form-input:focus {
          ring: 2px solid rgba(37, 99, 235, 0.5);
          border-color: rgba(37, 99, 235, 1);
        }
      `}</style>
    </div>
  );
}

function FilterButton({ active, onClick, label, icon, color = 'blue' }: { 
  active: boolean; 
  onClick: () => void; 
  label: string; 
  icon: React.ReactNode;
  color?: 'blue' | 'emerald' | 'amber' | 'rose';
}) {
  const colors = {
    blue: active ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800",
    emerald: active ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/10",
    amber: active ? "bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-500/20" : "text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/10",
    rose: active ? "bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-500/20" : "text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/10",
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-5 py-3 border rounded-2xl font-bold text-xs transition-all whitespace-nowrap uppercase tracking-widest",
        colors[color]
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: Product['status'] }) {
  const styles = {
    available: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800",
    low: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800",
    out_of_stock: "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800"
  };
  const labels = {
    available: "Disponible",
    low: "Faible",
    out_of_stock: "Rupture"
  };
  return (
    <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border", styles[status])}>
      {labels[status]}
    </span>
  );
}

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
