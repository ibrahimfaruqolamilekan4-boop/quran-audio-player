import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from '../lib/firebase';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // 1. Sync User Profile
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          const userData = {
            userId: currentUser.uid,
            email: currentUser.email || null,
            displayName: currentUser.displayName || null,
            photoURL: currentUser.photoURL || null,
            lastLoginAt: serverTimestamp()
          };

          if (!userSnap.exists()) {
            await setDoc(userRef, {
              ...userData,
              createdAt: serverTimestamp()
            });
          } else {
            await setDoc(userRef, userData, { merge: true });
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
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logOut }}>
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
