/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  ArrowUpDown,
  Search, 
  Filter, 
  Plus, 
  Loader2,
  Package,
  User,
  Calendar,
  FileDown,
  Mail,
  X,
  PlusCircle,
  MinusCircle,
  Truck,
  Users as UsersIcon,
  Wallet,
  Eye,
  FileText,
  Printer,
  Edit2
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  increment, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StockMovement, Product, Client, Supplier, MovementItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import { cn, formatCurrency, formatNumber } from '../lib/utils';
import { StatCard } from '../components/StatCard';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Movements() {
  const { lang } = useLang();
  const { profile } = useAuth();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [period, setPeriod] = useState<'day' | 'month' | 'year' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);

  const canEdit = profile?.role === 'SUPER_ADMIN';

  // Invoice Form State
  const [invoiceData, setInvoiceData] = useState<{
    type: 'IN' | 'OUT';
    actorId: string;
    items: { productId: string; quantity: number }[];
  }>({
    type: 'IN',
    actorId: '',
    items: [{ productId: '', quantity: 1 }]
  });

  useEffect(() => {
    const qMovements = query(collection(db, 'movements'), orderBy('createdAt', 'desc'));
    const unsubMovements = onSnapshot(qMovements, (snapshot) => {
      setMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockMovement)));
      setLoading(false);
    });

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });

    return () => {
      unsubMovements();
      unsubProducts();
      unsubClients();
      unsubSuppliers();
    };
  }, []);

  const filteredMovements = useMemo(() => {
    const now = new Date();
    const result = movements.filter(m => {
      const matchesSearch = m.actorName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          m.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'ALL' || m.type === typeFilter;
      
      const mDate = new Date(m.createdAt);
      let matchesPeriod = true;
      if (period === 'day') {
        const targetDate = new Date(selectedDate);
        matchesPeriod = mDate.toDateString() === targetDate.toDateString();
      } else if (period === 'month') {
        matchesPeriod = mDate.getMonth() === selectedMonth && mDate.getFullYear() === selectedYear;
      } else if (period === 'year') {
        matchesPeriod = mDate.getFullYear() === selectedYear;
      }

      return matchesSearch && matchesType && matchesPeriod;
    });

    return result.sort((a, b) => {
      const factor = sortOrder === 'asc' ? 1 : -1;
      return factor * (a.createdAt - b.createdAt);
    });
  }, [movements, searchTerm, typeFilter, period, sortOrder, selectedDate, selectedMonth, selectedYear]);

  const summary = useMemo(() => {
    const incomes = filteredMovements.filter(m => m.type === 'IN');
    const outcomes = filteredMovements.filter(m => m.type === 'OUT');
    const totalIn = incomes.reduce((acc, m) => acc + (Number(m.totalAmount) || 0), 0);
    const totalOut = outcomes.reduce((acc, m) => acc + (Number(m.totalAmount) || 0), 0);

    return {
      total: filteredMovements.length,
      inCount: incomes.length,
      outCount: outcomes.length,
      totalIn,
      totalOut,
      balance: totalOut - totalIn
    };
  }, [filteredMovements]);

  const handleAddItem = () => {
    setInvoiceData(prev => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: 1 }]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...invoiceData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setInvoiceData({ ...invoiceData, items: newItems });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceData.actorId || invoiceData.items.some(it => !it.productId)) {
      toast.error(lang === 'FR' ? 'Veuillez remplir tous les champs' : 'Please fill all fields');
      return;
    }

    try {
      const batch = writeBatch(db);
      
      // If Editing, reverse OLD stock first
      if (isEditing) {
        const oldM = movements.find(m => m.id === isEditing);
        if (oldM) {
          for (const item of (Array.isArray(oldM.items) ? oldM.items : [])) {
            const productRef = doc(db, 'products', item.productId);
            batch.update(productRef, {
              quantity: increment(oldM.type === 'IN' ? -item.quantity : item.quantity),
              updatedAt: Date.now()
            });
          }
        }
      }

      const movementItems: MovementItem[] = [];
      let totalAmount = 0;
      let totalItems = 0;

      for (const item of invoiceData.items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) continue;

        // Stock sufficiency check for OUT movements
        if (invoiceData.type === 'OUT') {
           // If editing, we need to account for the quantity already taken by this specific record
           let currentEffectiveStock = product.quantity;
           if (isEditing) {
             const oldM = movements.find(m => m.id === isEditing);
             const oldItem = oldM?.items?.find(it => it.productId === item.productId);
             if (oldM?.type === 'OUT' && oldItem) {
               currentEffectiveStock += oldItem.quantity;
             }
           }
           
           if (currentEffectiveStock < item.quantity) {
             toast.error(lang === 'FR' 
               ? `Stock insuffisant pour ${product.name} (Prévu: ${item.quantity}, Disponible: ${currentEffectiveStock})` 
               : `Insufficient stock for ${product.name} (Needed: ${item.quantity}, Available: ${currentEffectiveStock})`);
             return;
           }
        }

        const unitPrice = invoiceData.type === 'IN' ? product.buyPrice : product.sellPrice;
        const totalLinePrice = unitPrice * item.quantity;
        
        movementItems.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice,
          totalPrice: totalLinePrice
        });

        totalAmount += totalLinePrice;
        totalItems += item.quantity;

        // Apply NEW Stock
        const productRef = doc(db, 'products', product.id);
        batch.update(productRef, {
          quantity: increment(invoiceData.type === 'IN' ? item.quantity : -item.quantity),
          updatedAt: Date.now()
        });
      }

      const actor = invoiceData.type === 'IN' 
        ? suppliers.find(s => s.id === invoiceData.actorId)
        : clients.find(c => c.id === invoiceData.actorId);

      const movementData = {
        type: invoiceData.type,
        actorId: invoiceData.actorId,
        actorName: actor?.name || 'Unknown',
        items: movementItems,
        totalAmount,
        totalItems,
        updatedAt: Date.now()
      };

      if (isEditing) {
        const mRef = doc(db, 'movements', isEditing);
        batch.update(mRef, movementData);
      } else {
        const movementRef = doc(collection(db, 'movements'));
        batch.set(movementRef, {
          ...movementData,
          id: movementRef.id,
          userId: profile?.uid,
          userName: profile?.name,
          createdAt: Date.now()
        });
      }

      await batch.commit();

      toast.success(lang === 'FR' ? (isEditing ? 'Facture mise à jour' : 'Facture enregistrée') : (isEditing ? 'Invoice updated' : 'Invoice recorded'));
      setIsModalOpen(false);
      setIsEditing(null);
      setInvoiceData({ type: 'IN', actorId: '', items: [{ productId: '', quantity: 1 }] });
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de l\'enregistrement');
    }
  };


  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("GIM - Global Institute Management", 14, 20);
    doc.setFontSize(11);
    doc.text(`Rapport des Mouvements - ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = filteredMovements.map(m => [
      new Date(m.createdAt).toLocaleDateString(),
      m.type,
      m.actorName,
      m.totalItems,
      formatCurrency(m.totalAmount),
      m.userName
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Date', 'Type', 'Acteur', 'Produits', 'Montant', 'Utilisateur']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save(`movements_${Date.now()}.pdf`);
  };

  const sendMailReport = () => {
    if (!profile?.email) return;
    const subject = encodeURIComponent(`Mouvements GIM - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(`
Rapport de Mouvements & Facturations
Date: ${new Date().toLocaleDateString()}

Total Mouvements (Période): ${summary.total}
Total Entrées: ${formatCurrency(summary.totalIn)}
Total Sorties: ${formatCurrency(summary.totalOut)}
Solde: ${formatCurrency(summary.balance)}

Consultez le portail: ${window.location.origin}
    `.trim());
    window.location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`;
  };

  const exportInvoicePDF = (m: StockMovement) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont("helvetica", "bold");
    doc.text("GLOBAL INSTITUTE MANAGEMENT", 105, 15, { align: 'center' });
    
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // slate-400
    doc.setFont("helvetica", "normal");
    doc.text(`N° FACTURE: ${m.id.substring(0, 8).toUpperCase()}`, 14, 25);
    doc.text(`DATE: ${new Date(m.createdAt).toLocaleDateString()} ${new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`, 14, 29);
    
    // Partner info
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(m.type === 'IN' ? "FOURNISSEUR" : "CLIENT", 14, 38);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(String(m.actorName || '').toUpperCase(), 14, 43);
    doc.setFont("helvetica", "normal");

    // Table
    autoTable(doc, {
      startY: 50,
      head: [['Désignation', 'Qté', 'P. Unit', 'Total']],
      body: (Array.isArray(m.items) ? m.items : []).map(it => [
        it.productName,
        it.quantity,
        formatCurrency(it.unitPrice || 0),
        formatCurrency(it.totalPrice || 0)
      ]),
      foot: [['', '', 'TOTAL (FCFA)', formatCurrency(m.totalAmount || 0)]],
      theme: 'grid',
      headStyles: { 
        fillColor: m.type === 'IN' ? [16, 185, 129] : [37, 99, 235], 
        halign: 'center', 
        fontSize: 7,
        fontStyle: 'bold'
      },
      footStyles: { 
        fillColor: [248, 250, 252], 
        textColor: [15, 23, 42], 
        fontStyle: 'bold', 
        halign: 'right', 
        fontSize: 8 
      },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left' },
        1: { halign: 'center', cellWidth: 12 },
        2: { halign: 'right', cellWidth: 22 },
        3: { halign: 'right', cellWidth: 25 },
      },
      styles: { 
        fontSize: 7, 
        cellPadding: 1.2, 
        overflow: 'linebreak'
      },
      margin: { left: 14, right: 14 }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY || 70;
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("Arrêté la présente facture à la somme de :", 14, finalY + 10);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(m.totalAmount || 0), 14, finalY + 16);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Agent: ${m.userName || ''}`, 14, finalY + 25);

    doc.save(`Facture_${m.actorName}_${Date.now()}.pdf`);
    toast.success(lang === 'FR' ? "Facture PDF générée" : "Invoice PDF generated");
  };

  const openEditModal = (m: StockMovement) => {
    setIsEditing(m.id);
    setInvoiceData({
      type: m.type,
      actorId: m.actorId,
      items: (Array.isArray(m.items) ? m.items : []).map(it => ({ productId: it.productId, quantity: it.quantity }))
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-8 bg-blue-600 rounded-full" />
            <h1 className="text-3xl font-black tracking-tight dark:text-white uppercase">
              {lang === 'FR' ? 'Mouvements & Facturations' : 'Movements & Invoicing'}
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium ml-4">
            {lang === 'FR' ? 'Gestion des entrées, ventes et historique' : 'Manage entries, sales and history'}
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
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2 font-black uppercase tracking-widest text-[10px]"
          >
            <Plus size={16} />
            {lang === 'FR' ? 'Nouvelle Facture' : 'New Invoice'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label={lang === 'FR' ? 'Mouvements' : 'Movements'} 
          value={summary.total.toString()}
          subValue={`${summary.inCount} Entrées / ${summary.outCount} Sorties`}
          icon={<ArrowUpCircle />}
          color="blue"
        />
        <StatCard 
          label={lang === 'FR' ? 'Total Entrées' : 'Total Entries'} 
          value={formatCurrency(summary.totalIn)}
          icon={<Truck />}
          color="emerald"
        />
        <StatCard 
          label={lang === 'FR' ? 'Total Sorties' : 'Total Sales'} 
          value={formatCurrency(summary.totalOut)}
          icon={<UsersIcon />}
          color="blue"
        />
        <StatCard 
          label={lang === 'FR' ? 'Solde en Caisse' : 'Cash Balance'} 
          value={formatCurrency(summary.balance)}
          icon={<Wallet />}
          trend={lang === 'FR' ? 'Flux Net' : 'Net Flow'}
          isPositive={summary.balance >= 0}
          color={summary.balance >= 0 ? 'emerald' : 'rose'}
        />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-6 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={lang === 'FR' ? 'Rechercher par acteur ou N° Facture...' : 'Search by actor or Invoice N°...'}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-hidden focus:ring-2 focus:ring-blue-500/50 transition-all dark:text-white shadow-sm font-medium"
            />
          </div>

          <div className="xl:col-span-6 flex flex-wrap gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-2xl shadow-sm">
                {(['day', 'month', 'year', 'all'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      period === p 
                        ? "bg-blue-600 text-white shadow shadow-blue-500/20" 
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {lang === 'FR' ? (p === 'day' ? 'Jour' : p === 'month' ? 'Mois' : p === 'year' ? 'An' : 'Tout') : p}
                  </button>
                ))}
              </div>

              {/* Specific Date Selectors */}
              {period === 'day' && (
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono outline-hidden focus:ring-2 focus:ring-blue-500/30 w-32 md:w-auto"
                />
              )}
              {period === 'month' && (
                <div className="flex gap-1 transform scale-90 origin-left">
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

            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-all shadow-sm"
            >
              <ArrowUpDown size={14} />
              {sortOrder === 'asc' ? (lang === 'FR' ? 'Ancien' : 'Oldest') : (lang === 'FR' ? 'Récent' : 'Newest')}
            </button>
            
            <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-2xl shadow-sm">
              {(['ALL', 'IN', 'OUT'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    typeFilter === t 
                      ? (t === 'IN' ? "bg-emerald-600 text-white shadow shadow-emerald-500/20" : t === 'OUT' ? "bg-blue-600 text-white shadow shadow-blue-500/20" : "bg-slate-800 text-white shadow-sm")
                      : "text-slate-400"
                  )}
                >
                  {t === 'ALL' ? (lang === 'FR' ? 'Tous' : 'All') : t === 'IN' ? (lang === 'FR' ? 'Entrées' : 'IN') : (lang === 'FR' ? 'Sorties' : 'OUT')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Acteur (Client/Fourn.)</th>
                  <th className="px-6 py-4 text-center">Items</th>
                  <th className="px-6 py-4">Montant Total</th>
                  <th className="px-6 py-4">Agent</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center"><Loader2 className="animate-spin text-blue-600 mx-auto" /></td></tr>
                ) : filteredMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold dark:text-white">{new Date(m.createdAt).toLocaleDateString()}</p>
                      <p className="text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                        m.type === 'IN' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100"
                      )}>
                        {m.type === 'IN' ? (lang === 'FR' ? 'ENTREE' : 'IN') : (lang === 'FR' ? 'SORTIE' : 'OUT')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "font-bold text-sm",
                        m.type === 'IN' ? "text-emerald-600" : "text-blue-600"
                      )}>
                        {m.actorName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-mono font-bold dark:text-white px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">{m.totalItems}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-slate-800 dark:text-white">{formatCurrency(m.totalAmount)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-[10px] text-slate-600 uppercase font-bold">
                        <User size={12} />
                        {m.userName}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => setSelectedMovement(m)}
                          className="p-2 text-slate-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-all"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {canEdit && (
                          <button 
                            onClick={() => openEditModal(m)}
                            className="p-2 text-slate-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-all"
                            title="Edit Invoice"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => exportInvoicePDF(m)}
                          className="p-2 text-slate-400 hover:text-emerald-600 rounded-full hover:bg-emerald-50 transition-all"
                          title="Print Invoice"
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                <div>
                  <h2 className="text-xl font-black dark:text-white uppercase tracking-tight">
                    {lang === 'FR' ? (isEditing ? 'Modification de Facture' : 'Création de Facture') : (isEditing ? 'Edit Invoice' : 'Create Invoice')}
                  </h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                    {invoiceData.type === 'IN' ? (lang === 'FR' ? 'Entrée de stock' : 'Stock Arrival') : (lang === 'FR' ? 'Sortie / Vente' : 'Sale Out')}
                  </p>
                </div>
                <button onClick={() => {
                  setIsModalOpen(false);
                  setIsEditing(null);
                }} className="p-2 text-slate-300 hover:text-slate-600 dark:hover:text-white rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[80vh] overflow-y-auto scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type de Flux</label>
                    <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
                      <button 
                        type="button" 
                        onClick={() => setInvoiceData({...invoiceData, type: 'IN', actorId: ''})}
                        className={cn(
                          "flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wididst transition-all",
                          invoiceData.type === 'IN' ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-500"
                        )}
                      >
                        {lang === 'FR' ? 'Entrée / Arrivage' : 'Entry / Inbound'}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setInvoiceData({...invoiceData, type: 'OUT', actorId: ''})}
                        className={cn(
                          "flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wididst transition-all",
                          invoiceData.type === 'OUT' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-500"
                        )}
                      >
                        {lang === 'FR' ? 'Sortie / Vente' : 'Sale / Outbound'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {invoiceData.type === 'IN' ? (lang === 'FR' ? 'Fournisseur' : 'Supplier') : (lang === 'FR' ? 'Client' : 'Client')}
                    </label>
                    <select 
                      required
                      value={invoiceData.actorId}
                      onChange={(e) => setInvoiceData({...invoiceData, actorId: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-white font-bold"
                    >
                      <option value="">{lang === 'FR' ? 'Choisir un acteur' : 'Choose partner'}</option>
                      {invoiceData.type === 'IN' ? (
                        suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                      ) : (
                        clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                      )}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Détails des Articles</h3>
                    <button 
                      type="button" 
                      onClick={handleAddItem}
                      className="flex items-center gap-1.5 text-blue-600 font-bold text-xs hover:underline decoration-2 underline-offset-4"
                    >
                      <PlusCircle size={16} /> Ajouter une ligne
                    </button>
                  </div>

                  <div className="space-y-4 bg-slate-50 dark:bg-slate-800/30 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                    <div className="grid grid-cols-12 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-2">
                      <div className="col-span-5">Désignation Produit</div>
                      <div className="col-span-2 text-center">Qté</div>
                      <div className="col-span-2 text-right">P. Unit</div>
                      <div className="col-span-2 text-right">Total</div>
                      <div className="col-span-1"></div>
                    </div>

                    {invoiceData.items.map((item, index) => {
                      const product = products.find(p => p.id === item.productId);
                      const unitPrice = invoiceData.type === 'IN' ? product?.buyPrice : product?.sellPrice;
                      
                      return (
                        <div key={index} className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-5">
                            <select 
                              required
                              value={item.productId}
                              onChange={(e) => updateItem(index, 'productId', e.target.value)}
                              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-white text-xs font-bold"
                            >
                              <option value="">Article...</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} {p.quantity > 0 ? `(${p.quantity})` : '(Rupture)'}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <input 
                              type="number" min="1" required
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full px-2 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-hidden text-center text-xs font-mono font-bold dark:text-white"
                            />
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-[10px] font-mono text-slate-400">
                              {unitPrice ? formatCurrency(unitPrice) : '---'}
                            </span>
                          </div>
                          <div className="col-span-2 text-right font-black text-xs text-slate-800 dark:text-white">
                            {unitPrice ? formatCurrency(unitPrice * item.quantity) : '---'}
                          </div>
                          <div className="col-span-1 text-center">
                            {invoiceData.items.length > 1 && (
                              <button 
                                type="button" 
                                onClick={() => handleRemoveItem(index)}
                                className="p-1 text-rose-300 hover:text-rose-500 transition-colors"
                              >
                                <MinusCircle size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="p-6 bg-slate-900 text-white rounded-3xl min-w-[240px]">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Montant Total Facture</p>
                    <h3 className="text-2xl font-black font-mono">
                      {formatCurrency(invoiceData.items.reduce((acc, it) => {
                        const p = products.find(prod => prod.id === it.productId);
                        const price = invoiceData.type === 'IN' ? (Number(p?.buyPrice) || 0) : (Number(p?.sellPrice) || 0);
                        return acc + (price * (Number(it.quantity) || 0));
                      }, 0))}
                    </h3>
                  </div>

                  <div className="flex gap-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 font-black uppercase tracking-widest text-[10px] text-slate-400 hover:text-slate-600 transition-all">
                      Annuler
                    </button>
                    <button type="submit" className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 transition-all active:scale-95">
                      Enregistrer & Valider
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMovement && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedMovement(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden p-8"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className={cn(
                    "inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4",
                    selectedMovement.type === 'IN' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                  )}>
                    {selectedMovement.type === 'IN' ? 'Entrée de Stock' : 'Bon de Sortie'}
                  </div>
                  <h2 className="text-2xl font-black dark:text-white tracking-tight uppercase">
                    Facture #{selectedMovement.id.substring(0, 8).toUpperCase()}
                  </h2>
                  <p className="text-slate-500 font-medium">Par {selectedMovement.userName} • {new Date(selectedMovement.createdAt).toLocaleString()}</p>
                </div>
                <button onClick={() => setSelectedMovement(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 mb-8">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{selectedMovement.type === 'IN' ? 'Fournisseur' : 'Client'}</span>
                  <span className="font-black dark:text-white">{selectedMovement.actorName}</span>
                </div>
                <div className="space-y-3">
                  {(Array.isArray(selectedMovement.items) ? selectedMovement.items : []).map((it, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-2 border-b border-white dark:border-slate-800 last:border-0">
                      <div>
                        <p className="font-bold dark:text-white">{it.productName}</p>
                        <p className="text-[10px] text-slate-400">Qté: {it.quantity} x {formatCurrency(it.unitPrice)}</p>
                      </div>
                      <span className="font-black dark:text-white self-center">{formatCurrency(it.totalPrice)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total à payer</p>
                  <p className="text-3xl font-black font-mono dark:text-white tracking-tighter">{formatCurrency(selectedMovement.totalAmount)}</p>
                </div>
                <button 
                  onClick={() => exportInvoicePDF(selectedMovement)}
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
                >
                  <Printer size={18} />
                  Imprimer la Facture
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
