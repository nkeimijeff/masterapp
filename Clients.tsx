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
  User,
  ArrowUpDown,
  X,
  Loader2,
  MapPin,
  Phone,
  CheckCircle,
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
import { Client, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import { cn } from '../lib/utils';
import { StatCard } from '../components/StatCard';
import { toast } from 'sonner';

export default function Clients() {
  const { lang } = useLang();
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState<'day' | 'month' | 'year' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [sortField, setSortField] = useState<'name' | 'createdAt' | 'location'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form State
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    photoURL: ''
  });

  const canManage = profile?.role === 'SUPER_ADMIN' || profile?.role === 'DG' || profile?.role === 'CC';

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        setLoading(false);
      },
      (error) => {
        console.error("Clients fetch error:", error);
        toast.error(lang === 'FR' ? "Erreur d'accès aux données" : "Data access error");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [lang]);

  const filteredClients = useMemo(() => {
    let result = clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
    );

    // Period Filter
    result = result.filter(c => {
      const cDate = new Date(c.createdAt);
      if (period === 'day') {
        const targetDate = new Date(selectedDate);
        return cDate.toDateString() === targetDate.toDateString();
      }
      if (period === 'month') {
        return cDate.getMonth() === selectedMonth && cDate.getFullYear() === selectedYear;
      }
      if (period === 'year') {
        return cDate.getFullYear() === selectedYear;
      }
      return true;
    });

    // Sorting
    return result.sort((a, b) => {
      const factor = sortOrder === 'asc' ? 1 : -1;
      if (sortField === 'name') return factor * a.name.localeCompare(b.name);
      if (sortField === 'createdAt') return factor * (a.createdAt - b.createdAt);
      if (sortField === 'location') return factor * (a.location || '').localeCompare(b.location || '');
      return 0;
    });
  }, [clients, searchTerm, period, selectedDate, selectedMonth, selectedYear, sortField, sortOrder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      toast.error(lang === 'FR' ? 'Accès refusé' : 'Access denied');
      return;
    }

    try {
      if (isEditing) {
        await updateDoc(doc(db, 'clients', isEditing.id), {
          ...formData,
          updatedAt: Date.now()
        });
        toast.success(lang === 'FR' ? 'Client modifié !' : 'Client updated!');
      } else {
        await addDoc(collection(db, 'clients'), {
          ...formData,
          createdAt: Date.now()
        });
        toast.success(lang === 'FR' ? 'Client enregistré !' : 'Client registered!');
      }
      setIsModalOpen(false);
      setIsEditing(null);
      setFormData({ name: '', email: '', phone: '', location: '', photoURL: '' });
    } catch (error) {
      toast.error('Error saving client');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canManage) {
      toast.error(lang === 'FR' ? 'Accès refusé' : 'Access denied');
      return;
    }
    if (!window.confirm(lang === 'FR' ? `Supprimer le client ${name} ?` : `Delete client ${name}?`)) return;

    setIsDeleting(id);
    try {
      await deleteDoc(doc(db, 'clients', id));
      toast.success(lang === 'FR' ? 'Client supprimé' : 'Client deleted');
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
    doc.text(`Liste des Clients - ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = clients.map(c => [
      c.name,
      c.email,
      c.phone,
      c.location
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Client', 'Email', 'Téléphone', 'Localisation']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
    });

    doc.save(`clients_${Date.now()}.pdf`);
    toast.success('PDF Exporté');
  };

  const sendEmail = (client: Client) => {
    const subject = encodeURIComponent("Information de Global Institute Management");
    const body = encodeURIComponent(`Bonjour ${client.name},\n\n...`);
    window.open(`mailto:${client.email}?subject=${subject}&body=${body}`);
  };

  const openEditModal = (client: Client) => {
    setIsEditing(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone,
      location: client.location,
      photoURL: client.photoURL || ''
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">{lang === 'FR' ? 'Gestion Clients' : 'Clients Management'}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {clients.length} {lang === 'FR' ? 'clients enregistrés' : 'clients registered'}
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
              setFormData({ name: '', email: '', phone: '', location: '', photoURL: '' });
              setIsModalOpen(true);
            }}
            className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Plus size={18} />
            {lang === 'FR' ? 'Nouveau Client' : 'Add Client'}
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          label={lang === 'FR' ? 'Total Clients' : 'Total Clients'} 
          value={clients.length.toString()} 
          icon={<User />}
          color="blue"
        />
        <StatCard 
          label={lang === 'FR' ? 'Nouveaux (Mois)' : 'New (Month)'} 
          value={clients.filter(c => new Date(c.createdAt).getMonth() === new Date().getMonth()).length.toString()} 
          icon={<CheckCircle />}
          color="emerald"
        />
        <StatCard 
          label={lang === 'FR' ? 'Localisations' : 'Locations'} 
          value={new Set(clients.map(c => c.location)).size.toString()} 
          icon={<MapPin />}
          color="amber"
        />
      </div>

      {/* Filters & Search */}
        <div className="flex flex-col xl:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={lang === 'FR' ? 'Rechercher un client...' : 'Search clients...'}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500/50 transition-all dark:text-white font-medium"
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

            <div className="flex items-center gap-2">
              <select 
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase outline-hidden focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="name">{lang === 'FR' ? 'Nom' : 'Name'}</option>
                <option value="createdAt">{lang === 'FR' ? 'Date' : 'Date'}</option>
                <option value="location">{lang === 'FR' ? 'Localisation' : 'Location'}</option>
              </select>
              <button 
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-blue-500 transition-all shadow-sm"
              >
                <ArrowUpDown size={16} />
              </button>
            </div>
          </div>
        </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Localisation</th>
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
              ) : filteredClients.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                        {c.photoURL ? (
                          <img src={c.photoURL} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <User size={20} />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{c.name}</p>
                        <p className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Mail size={14} className="text-slate-400" />
                        {c.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Phone size={14} className="text-slate-400" />
                        {c.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <MapPin size={14} className="text-slate-400" />
                      {c.location}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => sendEmail(c)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                      >
                        <Mail size={16} />
                      </button>
                      <button 
                        onClick={() => openEditModal(c)}
                        disabled={!canManage}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all disabled:opacity-30"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={!canManage || isDeleting === c.id}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-30"
                      >
                        {isDeleting === c.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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
                  {isEditing ? (lang === 'FR' ? 'Modifier Client' : 'Edit Client') : (lang === 'FR' ? 'Nouveau Client' : 'Add Client')}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="flex flex-col items-center mb-6">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-full bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-500">
                      {formData.photoURL ? (
                        <img src={formData.photoURL} alt="Preview" className="w-full h-full object-cover" />
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
                      className="absolute bottom-0 right-0 p-3 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-500/30 hover:scale-110 active:scale-95 transition-all"
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

                <FormField label="Nom Complet" required>
                  <input 
                    required 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Jean Dupont" 
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
                      placeholder="jean@example.com" 
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
                    placeholder="Ex: Douala, Akwa" 
                    className="form-input" 
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
