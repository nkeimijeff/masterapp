/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Mail, 
  Shield, 
  Trash2, 
  Loader2,
  CheckCircle,
  Copy,
  ExternalLink,
  MessageCircle,
  Camera,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import { StatCard } from '../components/StatCard';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export default function Users() {
  const { lang } = useLang();
  const { profile: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<{name: string, email: string, tempPass: string, phone?: string} | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'EMPLOYEE' as UserRole,
    photoURL: ''
  });

  const filteredUsers = users.filter(u => {
    if (!currentUser) return false;
    if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'DG') return true;
    return u.managerId === currentUser.uid;
  });

  const getAllowedRoles = (): {value: UserRole, label: string}[] => {
    if (!currentUser) return [];
    if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'DG') {
      return [
        { value: 'DG', label: 'Directeur Général' },
        { value: 'CZ', label: 'Chef de Zone' },
        { value: 'CT', label: 'Chef Technique' },
        { value: 'CC', label: 'Chef Communication' },
        { value: 'EMPLOYEE', label: 'Employé' },
        { value: 'INTERN', label: 'Stagiaire' },
      ];
    }
    if (currentUser.role === 'CZ' || currentUser.role === 'CT' || currentUser.role === 'CC') {
      return [{ value: 'EMPLOYEE', label: lang === 'FR' ? 'Employé' : 'Employee' }];
    }
    if (currentUser.role === 'EMPLOYEE') {
      return [{ value: 'INTERN', label: lang === 'FR' ? 'Stagiaire' : 'Intern' }];
    }
    return [];
  };

  const currentAllowedRoles = getAllowedRoles();
  const canManageUsers = currentUser && (
    currentUser.role === 'SUPER_ADMIN' || 
    currentUser.role === 'DG' || 
    currentUser.role === 'CZ' || 
    currentUser.role === 'CT' || 
    currentUser.role === 'CC' || 
    currentUser.role === 'EMPLOYEE'
  );

  useEffect(() => {
    if (currentAllowedRoles.length > 0 && !isEditing) {
      setFormData(prev => ({ ...prev, role: currentAllowedRoles[0].value }));
    }
  }, [currentUser, isEditing]);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
        setLoading(false);
      },
      (error) => {
        console.error("Users load error:", error);
        toast.error(lang === 'FR' ? "Erreur de chargement des utilisateurs" : "Error loading users");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [lang]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) {
      toast.error(lang === 'FR' ? 'Accès refusé.' : 'Access denied.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing) {
        await updateDoc(doc(db, 'users', isEditing), {
          name: formData.name,
          phone: formData.phone,
          role: formData.role,
          photoURL: formData.photoURL
        });
        toast.success(lang === 'FR' ? "Utilisateur mis à jour" : "User updated");
      } else {
        const isEmailTaken = users.some(u => u.email.toLowerCase() === formData.email.toLowerCase());
        if (isEmailTaken) {
          toast.error(lang === 'FR' ? "Cet email est déjà utilisé." : "This email is already taken.");
          setIsSubmitting(false);
          return;
        }

        let secondaryApp;
        try {
          const secondaryAppName = `Secondary-${Date.now()}`;
          secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
          const secondaryAuth = getAuth(secondaryApp);
          
          const userCredential = await createUserWithEmailAndPassword(
            secondaryAuth, 
            formData.email, 
            formData.password
          );
          
          const uid = userCredential.user.uid;
          
          const newProfile: UserProfile = {
            uid: uid,
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            role: formData.role,
            tempPass: formData.password,
            managerId: currentUser?.uid, // Hierarchical link
            photoURL: formData.photoURL,
            createdAt: Date.now(),
          };

          await setDoc(doc(db, 'users', uid), newProfile);
          
          setCreatedUser({
            name: formData.name,
            email: formData.email,
            tempPass: formData.password,
            phone: formData.phone
          });

          toast.success(lang === 'FR' ? `Compte créé pour ${formData.name}` : `Account created for ${formData.name}`);
        } finally {
          if (secondaryApp) await deleteApp(secondaryApp);
        }
      }
      setFormData({ name: '', email: '', password: '', phone: '', role: 'EMPLOYEE', photoURL: '' });
      setIsModalOpen(false);
      setIsEditing(null);
    } catch (error: any) {
      console.error("Error saving user:", error);
      let msg = lang === 'FR' ? "Erreur lors de l'enregistrement" : "Error saving user";
      if (error.code === 'auth/email-already-in-use') msg = lang === 'FR' ? "Cet email est déjà utilisé." : "Email already in use.";
      if (error.code === 'auth/weak-password') msg = lang === 'FR' ? "Mot de passe trop faible (6 min)." : "Password too weak (min 6).";
      if (error.code === 'permission-denied') msg = lang === 'FR' ? "Permission refusée (Firestore)." : "Permission denied (Firestore).";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (user: UserProfile) => {
    setIsEditing(user.uid);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      phone: user.phone || '',
      role: user.role,
      photoURL: user.photoURL || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (uid: string) => {
    if (uid === currentUser?.uid) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte');
      return;
    }
    if (!window.confirm(lang === 'FR' ? "Supprimer cet utilisateur ?" : "Delete this user?")) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('Utilisateur supprimé');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const shareViaWhatsApp = (u: {name: string, email: string, tempPass?: string, phone?: string}) => {
    const text = `*Accès Global Institute Management*\n\nBonjour ${u.name},\nVoici vos identifiants :\nEmail: ${u.email}\nPass: ${u.tempPass || '*******'}\n\nLien: ${window.location.origin}`;
    const encodedText = encodeURIComponent(text);
    const phoneNum = u.phone?.replace(/\D/g, '') || '';
    window.open(`https://wa.me/${phoneNum}?text=${encodedText}`, '_blank');
  };

  const sendCredsByMail = (u: {name: string, email: string, tempPass?: string}) => {
    const subject = encodeURIComponent("Accès Global Institute Management");
    const body = encodeURIComponent(`Bonjour ${u.name},\n\nVoici vos identifiants pour Global Institute Management :\n\nEmail: ${u.email}\nMot de passe: ${u.tempPass || '*******'}\n\nLien d'accès: ${window.location.origin}`);
    window.location.href = `mailto:${u.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">{lang === 'FR' ? 'Gestion des Utilisateurs' : 'User Management'}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Contrôlez les accès à Global Institute Management</p>
        </div>
        <button 
          onClick={() => {
            setIsEditing(null);
            setFormData({ 
              name: '', 
              email: '', 
              password: '', 
              phone: '', 
              role: currentAllowedRoles[0]?.value || 'EMPLOYEE', 
              photoURL: '' 
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all opacity-100 disabled:opacity-0 disabled:pointer-events-none"
          disabled={!canManageUsers}
        >
          <UserPlus size={18} /> {lang === 'FR' ? 'Nouvel Utilisateur' : 'Add User'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          label={lang === 'FR' ? 'Membres Visibles' : 'Visible Members'} 
          value={filteredUsers.length.toString()} 
          icon={<Shield />}
          color="blue"
        />
        <StatCard 
          label={lang === 'FR' ? 'Mes Collaborateurs' : 'My Collaborators'} 
          value={filteredUsers.filter(u => u.managerId === currentUser?.uid).length.toString()} 
          icon={<Shield />}
          color="emerald"
        />
        <StatCard 
          label={lang === 'FR' ? 'Accès Privilégiés' : 'Privileged Access'} 
          value={filteredUsers.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'DG' || u.role === 'CC').length.toString()} 
          icon={<Shield />}
          color="indigo"
        />
      </div>
      
      {/* Success View for Created User */}
      <AnimatePresence>
        {createdUser && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-3xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4">
              <button 
                onClick={() => setCreatedUser(null)}
                className="text-blue-600 hover:text-blue-800"
              >
                <CheckCircle size={24} />
              </button>
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-800 text-blue-600 flex items-center justify-center">
                <CheckCircle size={32} />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">
                  {lang === 'FR' ? `Nouveau compte : ${createdUser.name}` : `New account: ${createdUser.name}`}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-blue-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email / Pass</p>
                    <p className="font-mono text-sm dark:text-white truncate">{createdUser.email} / {createdUser.tempPass}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => shareViaWhatsApp(createdUser)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
                >
                  <MessageCircle size={16} /> WhatsApp
                </button>
                <button 
                  onClick={() => sendCredsByMail(createdUser)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
                >
                  <Mail size={16} /> Email
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`Email: ${createdUser.email}\nPass: ${createdUser.tempPass}`);
                    toast.success(lang === 'FR' ? 'Copié !' : 'Copied!');
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Nom & Email</th>
                <th className="px-6 py-4">Rôle</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></td></tr>
              ) : filteredUsers.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 text-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center font-bold overflow-hidden">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                        ) : (
                          u.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      u.role === 'SUPER_ADMIN' ? "bg-purple-50 text-purple-600 border-purple-100" :
                      u.role === 'DG' ? "bg-blue-50 text-blue-600 border-blue-100" :
                      "bg-slate-50 text-slate-600 border-slate-100"
                    )}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-mono text-slate-600 dark:text-slate-400">{u.phone || '-'}</p>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end items-center gap-1">
                    <button 
                      onClick={() => sendCredsByMail(u)}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                      title={lang === 'FR' ? "Envoyer Identifiants par Email" : "Send Credentials via Email"}
                    >
                      <Mail size={16} />
                    </button>
                    {u.phone && (
                      <button 
                        onClick={() => shareViaWhatsApp(u)}
                        className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                        title={lang === 'FR' ? "Envoyer sur WhatsApp" : "Send on WhatsApp"}
                      >
                        <MessageCircle size={16} />
                      </button>
                    )}
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
                    <button 
                      onClick={() => handleEditClick(u)}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(u.uid)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-bold dark:text-white">
                {isEditing ? 'Modifier le compte' : 'Créer un nouveau compte'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nom Complet</label>
                <input 
                  required 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Email Professionnel</label>
                <input 
                  required 
                  disabled={!!isEditing}
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-white disabled:opacity-50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Téléphone (WhatsApp)</label>
                <input 
                  type="tel" 
                  placeholder="+237..."
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-white"
                />
              </div>
              {!isEditing && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mot de Passe Temporaire</label>
                  <input 
                    required 
                    type="text" 
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Photo de Profil</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                    {formData.photoURL ? (
                      <img src={formData.photoURL} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="text-slate-300" />
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-300 shadow-xs"
                  >
                    {lang === 'FR' ? 'Choisir Photo' : 'Choose Photo'}
                  </button>
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
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rôle</label>
                <select 
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-white"
                >
                  {currentAllowedRoles.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 font-bold text-slate-500 hover:text-slate-700"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : (isEditing ? 'Enregistrer' : 'Créer le Compte')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
