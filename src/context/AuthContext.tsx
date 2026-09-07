import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

interface AuthContextType {
  role: 'user' | 'admin' | null;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'user' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // 1. Sync User Profile
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          let currentRole = 'user';
          if (currentUser.email === 'ibrahimfaruqolamilekan4@gmail.com') {
             currentRole = 'admin';
          }
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              userId: currentUser.uid,
              email: currentUser.email || null,
              displayName: currentUser.displayName || null,
              photoURL: currentUser.photoURL || null,
              role: currentRole,
              createdAt: serverTimestamp(),
              lastLoginAt: serverTimestamp()
            });
            setRole(currentRole as any);
          } else {
            const data = userSnap.data();
            currentRole = data.role || currentRole;
            await setDoc(userRef, {
              userId: currentUser.uid,
              email: currentUser.email || null,
              displayName: currentUser.displayName || null,
              photoURL: currentUser.photoURL || null,
              lastLoginAt: serverTimestamp()
            }, { merge: true });
            setRole(currentRole as any);
          }
          // 2. Initialize user preferences if they don't exist
          const prefRef = doc(db, 'users', currentUser.uid, 'preferences', 'default');
          const prefSnap = await getDoc(prefRef);
          if (!prefSnap.exists()) {
            await setDoc(prefRef, {
              userId: currentUser.uid,
              theme: 'midnight-scholar',
              activeBackgroundVideoId: null,
              updatedAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.error("Failed to sync user profile or initialize preferences", e);
        }
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);


  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };
  const signUpWithEmail = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
