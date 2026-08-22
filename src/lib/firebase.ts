/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithPhoneNumber, 
  RecaptchaVerifier, 
  signInAnonymously, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  ConfirmationResult
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { UserProfile, EmergencyContact } from '../types';

export const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "",
  measurementId: (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID || ""
};

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Google Sign-In
export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

// Anonymous Sign-In
export async function signInAsGuest(): Promise<FirebaseUser> {
  const result = await signInAnonymously(auth);
  return result.user;
}

// Setup Phone reCAPTCHA
export function setupRecaptcha(containerId: string): RecaptchaVerifier {
  // Clear existing if any
  if ((window as any).recaptchaVerifier) {
    try {
      (window as any).recaptchaVerifier.clear();
    } catch (e) {}
  }
  
  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved
    },
    'expired-callback': () => {
      console.warn('reCAPTCHA expired, please try again.');
    },
  });

  (window as any).recaptchaVerifier = verifier;
  return verifier;
}

// Send Phone OTP
export async function sendPhoneOtp(
  phoneNumber: string, 
  verifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  // Format international number (e.g., +65 for Singapore)
  const cleanNumber = phoneNumber.trim().startsWith('+') 
    ? phoneNumber.trim() 
    : `+65${phoneNumber.trim().replace(/^0+/, '')}`;

  const confirmation = await signInWithPhoneNumber(auth, cleanNumber, verifier);
  return confirmation;
}

// Sign Out
export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

// Collection reference: Users
const USERS_COLLECTION = 'Users';

/**
 * Fetch a User profile by UID from Firestore collection `Users/{uid}`
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile from Firestore:', error);
    return null;
  }
}

/**
 * Save or update User profile in Firestore collection `Users/{uid}`
 */
export async function saveUserProfile(profile: Partial<UserProfile> & { uid: string }): Promise<void> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, profile.uid);
    const existing = await getDoc(userDocRef);

    const now = Date.now();
    const payload: Record<string, any> = {
      ...profile,
      updatedAt: now,
    };

    if (!existing.exists()) {
      payload.createdAt = now;
    }

    await setDoc(userDocRef, payload, { merge: true });
  } catch (error) {
    console.error('Error saving user profile to Firestore:', error);
    throw error;
  }
}

/**
 * Listen to real-time updates for a user's profile
 */
export function subscribeToUserProfile(
  uid: string, 
  callback: (profile: UserProfile | null) => void
): () => void {
  const userDocRef = doc(db, USERS_COLLECTION, uid);
  return onSnapshot(userDocRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as UserProfile);
    } else {
      callback(null);
    }
  }, (err) => {
    console.warn('Firestore profile subscription error:', err);
    callback(null);
  });
}
