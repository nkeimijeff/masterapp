/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router';
import { Toaster } from 'sonner';
import { Package, Plus, Loader2, Camera, X as CloseIcon } from 'lucide-react';
import { ThemeProvider } from './contexts/ThemeContext';
import { LangProvider } from './contexts/LangContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { db } from './lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

// Lazy load pages for better performance
const Welcome = lazy(() => import('./pages/Welcome'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Users = lazy(() => import('./pages/Users'));
const Clients = lazy(() => import('./pages/Clients'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Movements = lazy(() => import('./pages/Movements'));

const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
    <Loader2 className="animate-spin text-blue-600" size={24} />
  </div>
);

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="h-full flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
    <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
      <Package size={40} />
    </div>
    <h2 className="text-2xl font-bold dark:text-white mb-2">{title}</h2>
    <p className="text-slate-500 text-center max-w-md">Cette section est en cours de développement pour Global Institute Management.</p>
  </div>
);

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, loading } = useAuth();
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (profile && !profile.photoURL) {
      setShowPhotoPrompt(true);
    }
  }, [profile]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) { // 1MB limit for Firestore safety
      toast.error("L'image est trop lourde (Max 1Mo)");
      return;
    }

    const reader = new FileReader();
    reader.onloadstart = () => setIsUploading(true);
    reader.onload = async (event) => {
      const base64String = event.target?.result as string;
      try {
        await updateDoc(doc(db, 'users', profile!.uid), {
          photoURL: base64String
        });
        toast.success("Photo de profil mise à jour !");
        setShowPhotoPrompt(false);
      } catch (err) {
        toast.error("Erreur de sauvegarde");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Initialisation...</p>
        </div>
      </div>
    );
  }

  if (!profile) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-64 flex flex-col min-h-screen transition-all duration-300">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Profile Photo Prompt */}
      <AnimatePresence>
        {showPhotoPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-8 shadow-2xl relative overflow-hidden"
            >
               <button 
                onClick={() => setShowPhotoPrompt(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
              >
                <CloseIcon size={20} />
              </button>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-xl">
                  <Camera size={40} />
                </div>
                <div>
                  <h3 className="text-xl font-bold dark:text-white">Personnalisez votre profil</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ajoutez une photo pour être reconnu par vos collègues.</p>
                </div>

                <div className="w-full space-y-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-500 transition-all bg-slate-50 dark:bg-slate-800/50"
                  >
                    {isUploading ? (
                      <Loader2 size={24} className="animate-spin text-blue-600" />
                    ) : (
                      <>
                        <div className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm text-slate-400">
                          <Plus size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Choisir un fichier</span>
                      </>
                    )}
                  </div>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                  
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100 dark:border-slate-800"></div></div>
                    <div className="relative flex justify-center text-[8px] uppercase font-black text-slate-400 tracking-[0.2em] bg-white dark:bg-slate-900 px-2">Ou passer cette étape</div>
                  </div>

                  <button 
                    onClick={() => setShowPhotoPrompt(false)}
                    className="w-full py-3 text-slate-500 hover:text-slate-700 font-bold transition-all text-sm"
                  >
                    Plus tard
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Main App entry point
export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>
          <BrowserRouter>
            <Toaster position="top-right" richColors />
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="animate-spin text-blue-600" size={32} />
              </div>
            }>
              <Routes>
                <Route path="/" element={<Welcome />} />
                <Route path="/login" element={<Login />} />
                
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/movements" element={<Movements />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
