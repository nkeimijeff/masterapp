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
  Truck,
  ArrowUpDown,
  X,
  Loader2,
  MapPin,
  Phone,
  Package,
  Camera
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
import { Supplier, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import { cn } from '../lib/utils';
import { StatCard } from '../components/StatCard';
import { toast } from 'sonner';

export default function Suppliers() {
  const { lang } = useLang();
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState<'day' | 'month' | 'year' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form State
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    relatedArticles: '',
    photoURL: ''
  });

  const canManage = profile?.role === 'SUPER_ADMIN' || profile?.role === 'DG' || profile?.role === 'CZ';

  useEffect(() => {
    const q = query(collection(db, 'suppliers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
        setLoading(false);
      },
      (error) => {
        console.error("Suppliers fetch error:", error);
        toast.error(lang === 'FR' ? "Erreur d'accès aux données" : "Data access error");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [lang]);

  const [sortBy, setSortBy] = useState<'name' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredSuppliers = useMemo(() => {
    let result = suppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.relatedArticles?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Period Filter
    result = result.filter(s => {
      const sDate = new Date(s.createdAt);
      if (period === 'day') {
        const targetDate = new Date(selectedDate);
        return sDate.toDateString() === targetDate.toDateString();
      }
      if (period === 'month') {
        return sDate.getMonth() === selectedMonth && sDate.getFullYear() === selectedYear;
      }
      if (period === 'year') {
        return sDate.getFullYear() === selectedYear;
      }
      return true;
    });

    return result.sort((a, b) => {
      const factor = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'name') return factor * a.name.localeCompare(b.name);
      if (sortBy === 'createdAt') return factor * ((a.createdAt || 0) - (b.createdAt || 0));
      return 0;
    });
  }, [suppliers, searchTerm, sortBy, sortOrder, period, selectedDate, selectedMonth, selectedYear]);

  const toggleSort = () => {
    if (sortBy === 'name') {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('name');
      setSortOrder('asc');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      toast.error(lang === 'FR' ? 'Accès refusé' : 'Access denied');
      return;
    }

    try {
      if (isEditing) {
        await updateDoc(doc(db, 'suppliers', isEditing.id), {
          ...formData,
          updatedAt: Date.now()
        });
        toast.success(lang === 'FR' ? 'Fournisseur modifié !' : 'Supplier updated!');
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...formData,
          createdAt: Date.now()
        });
        toast.success(lang === 'FR' ? 'Fournisseur enregistré !' : 'Supplier registered!');
      }
      setIsModalOpen(false);
      setIsEditing(null);
      setFormData({ name: '', email: '', phone: '', location: '', relatedArticles: '', photoURL: '' });
    } catch (error: any) {
      console.error("Save supplier error:", error);
      toast.error(lang === 'FR' 
        ? `Erreur lors de l'enregistrement: ${error.message}` 
        : `Error saving: ${error.message}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canManage) {
      toast.error(lang === 'FR' ? 'Accès refusé' : 'Access denied');
      return;
    }
    if (!window.confirm(lang === 'FR' ? `Supprimer le fournisseur ${name} ?` : `Delete supplier ${name}?`)) return;

    setIsDeleting(id);
    try {
      await deleteDoc(doc(db, 'suppliers', id));
      toast.success(lang === 'FR' ? 'Fournisseur supprimé' : 'Supplier deleted');
    } catch (error) {
      toast.error('Error deleting');
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
    doc.text(`Liste des Fournisseurs - ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = suppliers.map(s => [
      s.name,
      s.email,
      s.phone,
      s.location,
      s.relatedArticles
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Nom', 'Email', 'Téléphone', 'Localisation', 'Articles']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
    });

    doc.save(`fournisseurs_${Date.now()}.pdf`);
    toast.success('PDF Exporté');
  };

  const sendEmail = (supplier: Supplier) => {
    const subject = encodeURIComponent("Demande d'information - StockMaster");
    const body = encodeURIComponent(`Bonjour ${supplier.name},\n\n...`);
    window.open(`mailto:${supplier.email}?subject=${subject}&body=${body}`);
  };

  const openEditModal = (supplier: Supplier) => {
    setIsEditing(supplier);
    setFormData({
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      location: supplier.location,
      relatedArticles: supplier.relatedArticles || '',
      photoURL: supplier.photoURL || ''
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">{lang === 'FR' ? 'Gestion Fournisseurs' : 'Suppliers Management'}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {suppliers.length} {lang === 'FR' ? 'fournisseurs enregistrés' : 'suppliers registered'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={exportPDF} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 text-slate-700 dark:text-slate-300 transition-all flex items-center gap-2 shadow-xs">
            <FileDown size={18} />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button 
            disabled={!canManage}
            onClick={() => {
              setIsEditing(null);
              setFormData({ name: '', email: '', phone: '', location: '', relatedArticles: '', photoURL: '' });
              setIsModalOpen(true);
            }}
            className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Plus size={18} />
            {lang === 'FR' ? 'Nouveau Fournisseur' : 'Add Supplier'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          label={lang === 'FR' ? 'Total Fournisseurs' : 'Total Suppliers'} 
          value={suppliers.length.toString()} 
          icon={<Truck />}
          color="blue"
        />
        <StatCard 
          label={lang === 'FR' ? 'Nouveaux Articles' : 'New Articles'} 
          value={suppliers.filter(s => new Date(s.createdAt).getMonth() === new Date().getMonth()).length.toString()} 
          icon={<Package />}
          color="emerald"
        />
        <StatCard 
          label={lang === 'FR' ? 'Localisations' : 'Locations'} 
          value={new Set(suppliers.map(s => s.location)).size.toString()} 
          icon={<MapPin />}
          color="amber"
        />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col xl:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={lang === 'FR' ? 'Rechercher un fournisseur...' : 'Search suppliers...'}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500/50 transition-all dark:text-white"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selection */}
          <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-xl">
            {(['day', 'month', 'year', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  period === p 
                    ? "bg-blue-600 text-white shadow-sm" 
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
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono outline-hidden focus:ring-2 focus:ring-blue-500/30"
            />
          )}
          {period === 'month' && (
            <div className="flex gap-1">
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase outline-hidden focus:ring-2 focus:ring-blue-500/30"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i}>{new Date(0, i).toLocaleString(lang === 'FR' ? 'fr-FR' : 'en-US', { month: 'short' })}</option>
                ))}
              </select>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black outline-hidden focus:ring-2 focus:ring-blue-500/30"
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
              className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black outline-hidden focus:ring-2 focus:ring-blue-500/30"
            >
              {[2023, 2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

          <button 
            onClick={toggleSort}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-100 transition-all"
          >
            <ArrowUpDown size={16} /> {lang === 'FR' ? 'Trier' : 'Sort'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Fournisseur</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Articles</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-blue-600 mx-auto" size={32} />
                  </td>
                </tr>
              ) : filteredSuppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                        {s.photoURL ? (
                          <img src={s.photoURL} alt={s.name} className="w-full h-full object-cover" />
                        ) : (
                          <Truck size={20} />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{s.name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin size={10} /> {s.location}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Mail size={14} className="text-slate-400" />
                        {s.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Phone size={14} className="text-slate-400" />
                        {s.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {s.relatedArticles?.split(',').map((art, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] rounded-md font-medium uppercase">
                          {art.trim()}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => sendEmail(s)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                      >
                        <Mail size={16} />
                      </button>
                      <button 
                        onClick={() => openEditModal(s)}
                        disabled={!canManage}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all disabled:opacity-30"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(s.id, s.name)}
                        disabled={!canManage || isDeleting === s.id}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-30"
                      >
                        {isDeleting === s.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
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
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h2 className="text-xl font-bold dark:text-white">
                  {isEditing ? (lang === 'FR' ? 'Modifier Fournisseur' : 'Edit Supplier') : (lang === 'FR' ? 'Nouveau Fournisseur' : 'Add Supplier')}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="flex flex-col items-center mb-6">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-500">
                      {formData.photoURL ? (
                        <img src={formData.photoURL} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Camera size={32} />
                          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Logo</span>
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
                        reader.onload = (ev) => setFormData({...formData, photoURL: ev.target?.result as string});
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden" 
                  />
                </div>

                <FormField label="Nom du Fournisseur" required>
                  <input 
                    required 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Global Tech Inc" 
                    className="form-input" 
                  />
                </FormField>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField label="Email" required>
                    <input 
                      required 
                      type="email" 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="contact@globaltech.com" 
                      className="form-input" 
                    />
                  </FormField>
                  <FormField label="Téléphone" required>
                    <input 
                      required 
                      type="tel" 
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="+237 ..." 
                      className="form-input" 
                    />
                  </FormField>
                </div>

                <FormField label="Localisation" required>
                  <input 
                    required 
                    type="text" 
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    placeholder="Ex: Douala, Bonanjo" 
                    className="form-input" 
                  />
                </FormField>

                <FormField label="Articles Concernés (séparés par des virgules)" required>
                  <textarea 
                    required
                    value={formData.relatedArticles}
                    onChange={(e) => setFormData({...formData, relatedArticles: e.target.value})}
                    placeholder="Ex: Ordinateurs, Souris, Claviers" 
                    className="form-input min-h-[80px]" 
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
          border-color: rgba(37, 99, 235, 1);
        }
      `}</style>
    </div>
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
