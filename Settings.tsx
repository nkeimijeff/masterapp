import React, { useState } from 'react';
import { 
  User, 
  Settings as SettingsIcon, 
  Globe, 
  Moon, 
  Sun, 
  Shield, 
  Database, 
  LogOut, 
  Save, 
  CheckCircle2,
  Lock,
  Smartphone,
  ChevronRight,
  Download,
  Upload,
  Loader2,
  Trash2, 
  AlertTriangle,
  FileCode
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, getDocs, collection, writeBatch, query, orderBy, limit, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StockMovement, Product, Client, Supplier } from '../types';
import { toast } from 'sonner';

type SettingsTab = 'profile' | 'lang' | 'security' | 'data';

export default function Settings() {
  const { profile, logout } = useAuth();
  const { lang, setLang } = useLang();
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const canReset = profile?.role === 'SUPER_ADMIN';

  const handleResetApp = async () => {
    if (!canReset) {
      toast.error(lang === 'FR' ? "Accès refusé" : "Access denied");
      return;
    }

    const confirm1 = window.confirm(lang === 'FR' 
      ? "ATTENTION : Voulez-vous vraiment vider les stocks et réinitialiser ? Toutes les données (Produits, Factures, Clients, Fournisseurs) seront supprimées définitivement." 
      : "WARNING: Do you really want to empty stocks and reset? All data (Products, Invoices, Clients, Suppliers) will be permanently deleted.");
    
    if (!confirm1) return;

    const confirm2 = window.confirm(lang === 'FR'
      ? "DERNIER AVERTISSEMENT : Cette action est irréversible. Confirmer la suppression totale ?"
      : "FINAL WARNING: This action is irreversible. Confirm total deletion?");

    if (!confirm2) return;

    setIsResetting(true);
    toast.loading(lang === 'FR' ? "Réinitialisation en cours..." : "Resetting in progress...");

    try {
      const collectionsToReset = ['products', 'movements', 'clients', 'suppliers', 'notifications', 'logs'];
      
      for (const collName of collectionsToReset) {
        const snap = await getDocs(collection(db, collName));
        if (snap.empty) continue;

        // Process in chunks of 500
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 500);
          chunk.forEach(docSnap => batch.delete(docSnap.ref));
          await batch.commit();
        }
      }

      toast.dismiss();
      toast.success(lang === 'FR' ? "Application réinitialisée avec succès !" : "App reset successfully!");
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error(lang === 'FR' ? "Erreur lors de la réinitialisation" : "Error during reset");
    } finally {
      setIsResetting(false);
    }
  };

  const [formData, setFormData] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
  });

  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains('dark'));

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    setDarkMode(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        name: formData.name,
        phone: formData.phone,
        updatedAt: Date.now()
      });
      toast.success(lang === 'FR' ? "Profil mis à jour" : "Profile updated");
    } catch (error) {
      toast.error("Erreur de mise à jour");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportData = async (format: 'json' | 'sql') => {
    if (!profile) return;
    setIsExporting(true);
    const toastId = toast.loading(lang === 'FR' ? "Préparation de l'export..." : "Preparing export...");
    
    try {
      const collectionsToExport = ['products', 'movements', 'clients', 'suppliers', 'users', 'notifications', 'logs'];
      const allData: any = {};

      for (const coll of collectionsToExport) {
        try {
          const snap = await getDocs(collection(db, coll));
          allData[coll] = snap.docs.map(doc => {
            const data = doc.data();
            // Process data to handle special types like Timestamps
            const processedData: any = { id: doc.id };
            Object.keys(data).forEach(key => {
              const val = data[key];
              if (val && typeof val === 'object' && 'seconds' in val && 'nanoseconds' in val) {
                // Firestore Timestamp
                processedData[key] = new Date(val.seconds * 1000).toISOString();
              } else {
                processedData[key] = val;
              }
            });
            return processedData;
          });
        } catch (err) {
          console.warn(`Could not export collection ${coll}:`, err);
          // Continue with other collections instead of failing entirely
        }
      }

      let content = '';
      let filename = `GIM_BACKUP_${new Date().toISOString().split('T')[0]}_${new Date().getTime()}`;
      let type = '';

      if (format === 'json') {
        content = JSON.stringify({
          meta: { 
            exportDate: new Date().toISOString(), 
            app: 'GIM', 
            exportedBy: profile?.name,
            version: '1.1'
          },
          data: allData
        }, null, 2);
        filename += '.json';
        type = 'application/json';
      } else {
        content = `-- GIM System SQL Export\n`;
        content += `-- Generate Date: ${new Date().toISOString()}\n`;
        content += `-- Exported By: ${profile?.name || 'Unknown'}\n\n`;

        for (const table in allData) {
          const items = allData[table];
          if (!items.length) continue;
          
          content += `\n-- Table: ${table}\n`;
          
          const allKeys = new Set<string>();
          items.forEach((item: any) => {
            Object.keys(item).forEach(key => {
              if (key !== 'id') allKeys.add(key);
            });
          });
          const keys = Array.from(allKeys);
          
          content += `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, ${keys.map(k => `${k} TEXT`).join(', ')});\n`;
          
          items.forEach((item: any) => {
            const values = keys.map(k => {
              const val = item[k];
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === 'number') return val;
              if (typeof val === 'boolean') return val ? '1' : '0';
              if (typeof val === 'object') {
                try {
                  return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                } catch {
                  return `'${String(val).replace(/'/g, "''")}'`;
                }
              }
              return `'${String(val).replace(/'/g, "''")}'`;
            });
            content += `INSERT INTO ${table} (id, ${keys.join(', ')}) VALUES ('${item.id}', ${values.join(', ')});\n`;
          });
        }
        filename += '.sql';
        type = 'text/plain';
      }

      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.dismiss(toastId);
      toast.success(lang === 'FR' ? "Export réussi !" : "Export successful!");
    } catch (err) {
      console.error('Export error:', err);
      toast.dismiss(toastId);
      toast.error(lang === 'FR' ? "Erreur critique lors de l'exportation" : "Critical error during export");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSQL = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const sql = e.target?.result as string;
      if (!sql) return;

      toast.loading("Importation SQL en cours...");
      try {
        const regex = /INSERT INTO (\w+) \((.*?)\) VALUES \((.*?)\);/g;
        let match;
        let count = 0;
        let batch = writeBatch(db);
        
        while ((match = regex.exec(sql)) !== null) {
          const [_, table, colsStr, valsStr] = match;
          const cols = colsStr.split(',').map(c => c.trim());
          
          // Better value parser for SQL (handles comma inside strings)
          const vals: any[] = [];
          let currentVal = '';
          let inString = false;
          for (let i = 0; i < valsStr.length; i++) {
            const char = valsStr[i];
            if (char === "'" && (i === 0 || valsStr[i-1] !== "\\")) {
              inString = !inString;
              currentVal += char;
            } else if (char === "," && !inString) {
              vals.push(currentVal.trim());
              currentVal = '';
            } else {
              currentVal += char;
            }
          }
          vals.push(currentVal.trim());

          const processedVals = vals.map(v => {
            if (v === 'NULL') return null;
            if (v.startsWith("'") && v.endsWith("'")) return v.substring(1, v.length - 1).replace(/''/g, "'");
            if (!isNaN(Number(v))) return Number(v);
            return v;
          });

          const data: any = {};
          cols.forEach((col, i) => { data[col] = processedVals[i]; });

          const id = data.id;
          delete data.id;
          
          batch.set(doc(db, table, id), data);
          count++;
          
          if (count % 400 === 0) {
            await batch.commit();
            batch = writeBatch(db);
          }
        }
        
        await batch.commit();
        toast.dismiss();
        toast.success(`${count} enregistrements importés.`);
      } catch (err) {
        console.error(err);
        toast.dismiss();
        toast.error("Erreur lors de l'importation SQL");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
          {lang === 'FR' ? 'Paramètres Système' : 'System Settings'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">{lang === 'FR' ? 'Configurez votre environnement et vos préférences' : 'Configure your environment and preferences'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Navigation Sidebar */}
        <div className="space-y-2">
          <SettingsNavButton 
            icon={<User size={18}/>} 
            label={lang === 'FR' ? 'Profil & Compte' : 'Profile & Account'} 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')}
          />
          <SettingsNavButton 
            icon={<Globe size={18}/>} 
            label={lang === 'FR' ? 'Langue & Theme' : 'Language & Theme'} 
            active={activeTab === 'lang'} 
            onClick={() => setActiveTab('lang')}
          />
          <SettingsNavButton 
            icon={<Database size={18}/>} 
            label={lang === 'FR' ? 'Données & Backup' : 'Data & Backup'} 
            active={activeTab === 'data'} 
            onClick={() => setActiveTab('data')}
          />
          
          <div className="pt-8">
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-500 font-black uppercase tracking-widest text-[10px] hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all"
            >
              <LogOut size={18} />
              {lang === 'FR' ? 'Déconnexion' : 'Logout'}
            </button>
          </div>
        </div>

        {/* Main Content Areas */}
        <div className="md:col-span-2">
          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.section 
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl">
                    <User size={20} />
                  </div>
                  <h2 className="text-xl font-black dark:text-white uppercase tracking-tight">{lang === 'FR' ? 'Mon Profil' : 'My Profile'}</h2>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">{lang === 'FR' ? 'Nom Complet' : 'Full Name'}</label>
                      <input 
                        type="text" 
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl outline-hidden focus:ring-2 focus:ring-blue-500/50 font-bold dark:text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">{lang === 'FR' ? 'Téléphone' : 'Phone Number'}</label>
                      <input 
                        type="tel" 
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl outline-hidden focus:ring-2 focus:ring-blue-500/50 font-bold dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Email</label>
                    <div className="w-full px-5 py-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 font-bold flex items-center justify-between">
                      {profile?.email}
                      <Lock size={14} />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isUpdating}
                    className="w-full py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isUpdating ? <div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full"/> : <Save size={18} />}
                    {lang === 'FR' ? 'Enregistrer les modifications' : 'Save Changes'}
                  </button>
                </form>
              </motion.section>
            )}

            {activeTab === 'lang' && (
              <motion.section 
                key="lang"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm space-y-8"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl">
                    <SettingsIcon size={20} />
                  </div>
                  <h2 className="text-xl font-black dark:text-white uppercase tracking-tight">{lang === 'FR' ? 'Affichage & Langue' : 'Display & Language'}</h2>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between py-4 border-b border-slate-50 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600">
                        <Globe size={18}/>
                      </div>
                      <div>
                        <p className="font-bold text-sm dark:text-white">{lang === 'FR' ? 'Langue de l\'interface' : 'Interface Language'}</p>
                        <p className="text-xs text-slate-400">{lang === 'FR' ? 'Français' : 'English'}</p>
                      </div>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                      <button 
                        onClick={() => setLang('FR')}
                        className={cn("px-4 py-2 rounded-lg text-[10px] font-black transition-all", lang === 'FR' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-400")}
                      > FR </button>
                      <button 
                        onClick={() => setLang('EN')}
                        className={cn("px-4 py-2 rounded-lg text-[10px] font-black transition-all", lang === 'EN' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-400")}
                      > EN </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600">
                        {darkMode ? <Moon size={18}/> : <Sun size={18}/>}
                      </div>
                      <div>
                        <p className="font-bold text-sm dark:text-white">{lang === 'FR' ? 'Mode Sombre' : 'Dark Mode'}</p>
                        <p className="text-xs text-slate-400">{lang === 'FR' ? 'Activer pour reposer vos yeux' : 'Rest your eyes'}</p>
                      </div>
                    </div>
                    <button 
                      onClick={toggleDarkMode}
                      className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", darkMode ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-800")}
                    >
                      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", darkMode ? "translate-x-6" : "translate-x-1")} />
                    </button>
                  </div>
                </div>
              </motion.section>
            )}

            {activeTab === 'data' && (
              <motion.section 
                key="data"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm space-y-8"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl">
                    <Database size={20} />
                  </div>
                  <h2 className="text-xl font-black dark:text-white uppercase tracking-tight">{lang === 'FR' ? 'Données & Backup' : 'Data & Backup'}</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* JSON Export */}
                  <div className="p-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] text-center space-y-4 hover:border-blue-500/50 transition-colors group">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/10 rounded-full flex items-center justify-center mx-auto text-blue-500">
                      <Download size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-sm dark:text-white">Format JSON</p>
                    </div>
                    <button 
                      disabled={isExporting}
                      onClick={() => handleExportData('json')}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      Export JSON
                    </button>
                  </div>

                  {/* SQL Export */}
                  <div className="p-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] text-center space-y-4 hover:border-emerald-500/50 transition-colors group">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/10 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                      <FileCode size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-sm dark:text-white">Format SQL</p>
                    </div>
                    <button 
                      disabled={isExporting}
                      onClick={() => handleExportData('sql')}
                      className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      Export SQL
                    </button>
                  </div>
                </div>

                <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Upload size={20} className="text-blue-500" />
                      <h3 className="font-bold dark:text-white">{lang === 'FR' ? 'Importation SQL' : 'SQL Import'}</h3>
                    </div>
                    <input 
                      type="file" accept=".sql" ref={fileInputRef} onChange={handleImportSQL} className="hidden"
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                      {lang === 'FR' ? 'Choisir Fichier' : 'Choose File'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {lang === 'FR' 
                      ? "Importez des fichiers .sql contenant des instructions INSERT INTO valides. Utilisez l'export SQL ci-dessus pour voir le format attendu." 
                      : "Import .sql files containing valid INSERT INTO statements. Use SQL export above to see expected format."}
                  </p>
                </div>

                {canReset && (
                  <div className="p-8 bg-rose-50 dark:bg-rose-900/10 rounded-[2rem] border border-rose-100 dark:border-rose-900/20 space-y-4">
                    <div className="flex items-center gap-4 text-rose-600 dark:text-rose-500">
                      <AlertTriangle size={32} />
                      <div className="text-left">
                        <p className="font-black uppercase tracking-tight text-sm">{lang === 'FR' ? 'Zone de Danger' : 'Danger Zone'}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 italic">{lang === 'FR' ? 'Action Irréversible' : 'Irreversible Action'}</p>
                      </div>
                    </div>
                    <p className="text-xs text-rose-700 dark:text-rose-400 text-left font-medium">
                      {lang === 'FR' 
                        ? "La réinitialisation supprimera tous les produits, mouvements, clients et fournisseurs. Vos comptes utilisateurs ne seront pas affectés." 
                        : "Resetting will delete all products, movements, clients, and suppliers. Your user accounts will not be affected."}
                    </p>
                    <button 
                      disabled={isResetting}
                      onClick={handleResetApp}
                      className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-rose-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isResetting ? <Loader2 className="animate-spin" size={16}/> : <Trash2 size={16}/>}
                      {lang === 'FR' ? 'VIDER LES STOCKS & RÉINITIALISER' : 'EMPTY STOCKS & RESET APP'}
                    </button>
                  </div>
                )}
              </motion.section>
            )}
          </AnimatePresence>

          <div className="p-8 bg-amber-50 dark:bg-amber-900/10 rounded-[2.5rem] border border-amber-100 dark:border-amber-900/20 text-center mt-8">
            <Smartphone size={24} className="mx-auto mb-3 text-amber-600" />
            <h4 className="font-black text-amber-800 dark:text-amber-500 uppercase tracking-tight">{lang === 'FR' ? 'GIM MOBILE DISPONIBLE' : 'GIM MOBILE AVAILABLE'}</h4>
            <p className="text-xs text-amber-700 dark:text-amber-600 mt-1">{lang === 'FR' ? 'Gérez votre stock depuis n\'importe où' : 'Manage your stock from anywhere'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsNavButton({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
      "w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all group",
      active ? "bg-slate-900 text-white shadow-xl shadow-slate-900/10" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(active ? "text-blue-400" : "text-slate-400 group-hover:text-blue-500")}>
          {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <ChevronRight size={14} className={cn(active ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
    </button>
  );
}
