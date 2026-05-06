/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { toast } from 'sonner';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUPER_ADMIN_EMAILS = ['jefftchatchoua068@gmail.com', 'nkeimi069@gmail.com'];
const SUPER_ADMIN_PASS = 'Nkeimi2008';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Set user immediately to allow some UI to render
      setUser(firebaseUser);

      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        
        // Use onSnapshot for real-time profile updates and better performance
        unsubscribeProfile = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
            setLoading(false);
          } else {
            // Document doesn't exist yet, create it
            try {
              const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                email: firebaseUser.email!,
                role: SUPER_ADMIN_EMAILS.includes(firebaseUser.email || '') ? 'SUPER_ADMIN' : 'EMPLOYEE',
                createdAt: Date.now(),
              };
              await setDoc(docRef, newProfile);
              setProfile(newProfile);
              setLoading(false);
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
              setLoading(false);
            }
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setLoading(false);
        });
      } else {
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const login = async (email: string, password: string) => {
    // Special handling for the hardcoded credentials if not in Firebase yet
    // In practice, we should assume they are in Firebase Auth or create them.
    // For this prototype, we try to sign in normally.
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      // If user doesn't exist but matches hardcoded ones, we might need a setup step
      // But we'll assume the user will create this user in Firebase console or it exists.
      throw error;
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
