import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  FileDown,
  Mail,
  Calendar,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { useNavigate } from 'react-router';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, StockMovement } from '../types';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatNumber, cn } from '../lib/utils';
import { StatCard } from '../components/StatCard';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Dashboard() {
  const { lang } = useLang();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'month' | 'year' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) setLoading(false);
    }, 5000);

    const prodsUnsub = onSnapshot(query(collection(db, 'products')), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const movsUnsub = onSnapshot(query(collection(db, 'movements'), orderBy('createdAt', 'desc')), (snapshot) => {
      setMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockMovement)));
      setLoading(false);
      clearTimeout(timeout);
    });

    return () => {
      prodsUnsub();
      movsUnsub();
      clearTimeout(timeout);
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
    const totalStock = products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
    const stockValue = products.reduce((acc, p) => acc + ((Number(p.quantity) || 0) * (Number(p.buyPrice) || 0)), 0);
    const sales = filteredMovements.filter(m => m.type === 'OUT').reduce((acc, m) => acc + (Number(m.totalAmount) || 0), 0);
    const purchases = filteredMovements.filter(m => m.type === 'IN').reduce((acc, m) => acc + (Number(m.totalAmount) || 0), 0);
    const alerts = products.filter(p => (Number(p.quantity) || 0) <= (Number(p.alertLevel) || 0)).length;

    return { totalStock, stockValue, sales, purchases, alerts };
  }, [products, filteredMovements]);

  const trendData = useMemo(() => {
    const map: Record<string, { name: string, in: number, out: number }> = {};
    
    // Sort filteredMovements by date ascending for the chart
    const sorted = [...filteredMovements].sort((a, b) => a.createdAt - b.createdAt);

    sorted.forEach(m => {
      const date = new Date(m.createdAt);
      let key = '';
      if (period === 'day') key = `${date.getHours()}h`;
      else if (period === 'month') key = `D${date.getDate()}`;
      else if (period === 'year') key = date.toLocaleString('default', { month: 'short' });
      else key = date.toLocaleDateString(lang === 'FR' ? 'fr-FR' : 'en-US', { day: '2-digit', month: '2-digit' });

      if (!map[key]) map[key] = { name: key, in: 0, out: 0 };
      const amount = Number(m.totalAmount) || 0;
      if (m.type === 'IN') map[key].in += amount;
      else map[key].out += amount;
    });

    const result = Object.values(map);
    return result.length > 0 ? result : [{ name: '...', in: 0, out: 0 }];
  }, [filteredMovements, period, lang]);

  const chartData = useMemo(() => {
    return products.slice(0, 6).map(p => ({
      name: (p.name || '').length > 10 ? p.name.substring(0, 10) + '...' : (p.name || 'N/A'),
      stock: Number(p.quantity) || 0,
      alert: Number(p.alertLevel) || 0
    }));
  }, [products]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("GIM - Global Institute Management", 14, 20);
    doc.setFontSize(11);
    doc.text(`Rapport Global - Période: ${period} - ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = [
      [lang === 'FR' ? 'Total Stock' : 'Total Stock', stats.totalStock],
      [lang === 'FR' ? 'Valeur Stock' : 'Stock Value', formatCurrency(stats.stockValue)],
      [lang === 'FR' ? 'Ventes' : 'Sales', formatCurrency(stats.sales)],
      [lang === 'FR' ? 'Achats' : 'Purchases', formatCurrency(stats.purchases)],
      [lang === 'FR' ? 'Alertes' : 'Alerts', stats.alerts]
    ];

    autoTable(doc, {
      startY: 40,
      head: [['Indicateur', 'Valeur']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save(`dashboard_${Date.now()}.pdf`);
    toast.success('PDF Exporté');
  };

  const sendMailReport = () => {
    if (!profile?.email) return;
    const lowStockItems = products.filter(p => p.quantity <= p.alertLevel);
    const subject = encodeURIComponent(`Rapport GIM - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(`
Rapport GIM - Dashboard
Période: ${period}

Ventes: ${formatCurrency(stats.sales)}
Achats: ${formatCurrency(stats.purchases)}
Alertes Stock: ${lowStockItems.length}

${lowStockItems.length > 0 ? `Articles en alerte:\n${lowStockItems.map(i => `- ${i.name}: ${i.quantity}`).join('\n')}` : ''}

Consultez le portail: ${window.location.origin}
    `.trim());
    window.location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`;
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <Spinner className="animate-spin text-blue-600" size={48} />
    </div>
  );

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
            {lang === 'FR' ? 'Tableau de Bord' : 'Admin Dashboard'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium font-sans">
            {lang === 'FR' ? 'Gestion Globale de l\'Institut' : 'Global Institute Management'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
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
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase outline-hidden focus:ring-2 focus:ring-blue-500/30"
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i} value={i}>{new Date(0, i).toLocaleString(lang === 'FR' ? 'fr-FR' : 'en-US', { month: 'long' })}</option>
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

          <div className="flex gap-2">
            <button onClick={sendMailReport} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-all shadow-sm">
              <Mail size={20} />
            </button>
            <button onClick={exportPDF} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-all shadow-sm">
              <FileDown size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<Package size={16} />} 
          label={lang === 'FR' ? 'Valeur du Stock' : 'Stock Value'} 
          value={formatCurrency(stats.stockValue)} 
          trend={`${stats.totalStock} articles`} 
          isPositive={true}
          color="blue"
        />
        <StatCard 
          icon={<TrendingUp size={16} />} 
          label={lang === 'FR' ? 'Chiffre d\'Affaires' : 'Total Sales'} 
          value={formatCurrency(stats.sales)} 
          trend={period !== 'all' ? `Période: ${period}` : "Total historique"} 
          isPositive={true}
          color="emerald"
        />
        <StatCard 
          icon={<TrendingDown size={16} />} 
          label={lang === 'FR' ? 'Achats' : 'Total Inbound'} 
          value={formatCurrency(stats.purchases)} 
          trend="Flux entrants" 
          isPositive={false}
          color="rose"
        />
        <StatCard 
          icon={<AlertTriangle size={16} />} 
          label={lang === 'FR' ? 'Alertes' : 'Alerts'} 
          value={stats.alerts.toString()} 
          trend={lang === 'FR' ? 'Action requise' : 'Action needed'} 
          isPositive={stats.alerts === 0}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <h3 className="text-lg font-black mb-8 flex items-center gap-2 dark:text-white uppercase tracking-tight">
            <TrendingUp size={20} className="text-blue-600" />
            {lang === 'FR' ? 'Flux Financiers Dynamiques' : 'Dynamic Financial Flow'}
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Area type="monotone" dataKey="in" name="Entrées" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
                <Area type="monotone" dataKey="out" name="Sorties" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <h3 className="text-lg font-black mb-8 flex items-center gap-2 dark:text-white uppercase tracking-tight">
            <Package size={20} className="text-indigo-600" />
            {lang === 'FR' ? 'État Critique des Stocks' : 'Critical Stock Status'}
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="stock" name="Stock" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                <Bar dataKey="alert" name="Alerte" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner({ className, size }: { className?: string, size?: number }) {
  return (
    <div className={className}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        style={{ width: size, height: size }}
        className="border-4 border-slate-200 border-t-blue-600 rounded-full"
      />
    </div>
  );
}
