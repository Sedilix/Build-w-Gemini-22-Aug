/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  User, 
  Camera, 
  Heart, 
  MapPin, 
  Calendar, 
  Phone, 
  Users, 
  ShieldCheck, 
  Check, 
  RefreshCw, 
  Upload, 
  Sparkles, 
  LogOut, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { UserProfile, BloodType, EmergencyContact, AccessibilitySettings } from '../types';
import { saveUserProfile, signOutUser } from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  profile: UserProfile | null;
  onProfileUpdated: (updated: UserProfile) => void;
  contacts: EmergencyContact[];
  onOpenManageContacts: () => void;
  settings: AccessibilitySettings;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  profile,
  onProfileUpdated,
  contacts,
  onOpenManageContacts,
  settings,
}) => {
  // Form State
  const [actualName, setActualName] = useState('');
  const [dob, setDob] = useState('');
  const [bloodType, setBloodType] = useState<BloodType>('O+');
  const [address, setAddress] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [selfiePhotoUrl, setSelfiePhotoUrl] = useState<string | undefined>(undefined);

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Saving State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isYellow = settings.contrastTheme === 'yellow-black';

  useEffect(() => {
    if (profile) {
      setActualName(profile.actualName || '');
      setDob(profile.dob || '');
      setBloodType(profile.bloodType || 'O+');
      setAddress(profile.address || '');
      setMedicalNotes(profile.medicalNotes || '');
      setSelfiePhotoUrl(profile.selfiePhotoUrl);
    } else if (user) {
      setActualName(user.displayName || '');
      if (user.phoneNumber) {
        // Pre-fill phone if available
      }
    }
  }, [profile, user, isOpen]);

  // Clean up camera on unmount or close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setIsSaving(false);
      setSaveSuccess(false);
      setErrorMessage(null);
    }
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Cannot open user selfie camera, falling back to file input:', err);
      setIsCameraActive(false);
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureSelfie = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw square crop centered
      const vWidth = videoRef.current.videoWidth || 400;
      const vHeight = videoRef.current.videoHeight || 400;
      const minDim = Math.min(vWidth, vHeight);
      const startX = (vWidth - minDim) / 2;
      const startY = (vHeight - minDim) / 2;

      ctx.drawImage(videoRef.current, startX, startY, minDim, minDim, 0, 0, 400, 400);
      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      setSelfiePhotoUrl(base64);
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          setSelfiePhotoUrl(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage('You must be signed in to save your profile.');
      return;
    }

    if (!actualName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updatedProfile: UserProfile = {
        uid: user.uid,
        actualName: actualName.trim(),
        dob: dob.trim(),
        bloodType,
        address: address.trim(),
        selfiePhotoUrl,
        emergencyContacts: contacts,
        phone: user.phoneNumber || profile?.phone,
        email: user.email || profile?.email,
        authProvider: user.isAnonymous ? 'anonymous' : (user.providerData[0]?.providerId.includes('google') ? 'google' : 'phone'),
        medicalNotes: medicalNotes.trim(),
        createdAt: profile?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await saveUserProfile(updatedProfile);
      onProfileUpdated(updatedProfile);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setErrorMessage(err.message || 'Failed to save profile to Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    stopCamera();
    await signOutUser();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      id="modal-profile-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn"
    >
      <div 
        id="modal-profile-content"
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col transition-all ${
          isYellow
            ? 'bg-black text-amber-300 border-amber-400'
            : settings.contrastTheme === 'black-white'
            ? 'bg-white text-black border-black'
            : 'bg-white text-slate-900 border-slate-200'
        }`}
      >
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${
          isYellow
            ? 'border-amber-400 bg-neutral-950'
            : 'border-slate-200/90 bg-slate-50/80'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              isYellow ? 'bg-amber-400 text-black' : 'bg-slate-900 text-white'
            }`}>
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-none">
                Senior User Profile
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-inherit/70 mt-1">
                Firestore Cloud Profile & SCDF Emergency Record
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="accessible-tap p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition-all"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSaveProfile} className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-bold flex items-center gap-2.5">
              <Check className="w-5 h-5 text-emerald-600" />
              <span>Profile updated in Firestore Users/{user?.uid}!</span>
            </div>
          )}

          {/* Section 1: Selfie Photo Capture */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600 dark:text-amber-400" />
                <label className="font-bold text-sm sm:text-base">
                  Profile Selfie Photo (Driver & Responder Visual ID)
                </label>
              </div>
              {selfiePhotoUrl && (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Photo Saved
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-inherit/70">
              Taking a clear selfie helps arriving caregivers and ambulance drivers spot you immediately.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
              {/* Photo Preview Circle */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-slate-300 dark:border-amber-400/80 bg-slate-200 shrink-0 shadow-md flex items-center justify-center">
                {isCameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : selfiePhotoUrl ? (
                  <img
                    src={selfiePhotoUrl}
                    alt="Senior Selfie"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-14 h-14 text-slate-400" />
                )}
              </div>

              {/* Action Buttons for Camera */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {isCameraActive ? (
                  <>
                    <button
                      type="button"
                      onClick={captureSelfie}
                      className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 text-white hover:bg-emerald-700 shadow-md flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-3 py-2.5 rounded-xl font-semibold text-xs sm:text-sm border border-slate-300 hover:bg-slate-100 dark:border-neutral-700"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{selfiePhotoUrl ? 'Retake Selfie' : 'Take Selfie Photo'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2.5 rounded-xl font-semibold text-xs sm:text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Personal Details (Name & DOB) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-inherit/80 mb-1.5">
                Full Actual Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={actualName}
                  onChange={(e) => setActualName(e.target.value)}
                  placeholder="e.g. Tan Ah Kow / Mary Lim"
                  className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-sm sm:text-base font-semibold focus:outline-none focus:ring-2 ${
                    isYellow
                      ? 'bg-neutral-900 border-amber-400 text-amber-300 focus:ring-amber-400'
                      : 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-inherit/80 mb-1.5">
                Date of Birth (DOB)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-sm sm:text-base font-semibold focus:outline-none focus:ring-2 ${
                    isYellow
                      ? 'bg-neutral-900 border-amber-400 text-amber-300 focus:ring-amber-400'
                      : 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-500'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Blood Type & Medical Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-inherit/80 mb-1.5">
                Blood Type (SCDF Ambulance Critical)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-rose-500">
                  <Heart className="w-4 h-4" />
                </div>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value as BloodType)}
                  className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-sm sm:text-base font-semibold focus:outline-none focus:ring-2 ${
                    isYellow
                      ? 'bg-neutral-900 border-amber-400 text-amber-300 focus:ring-amber-400'
                      : 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-500'
                  }`}
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown'].map((bt) => (
                    <option key={bt} value={bt}>
                      {bt} {bt === 'O+' ? '(Universal / Common)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-inherit/80 mb-1.5">
                Medical Notes / Allergies
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <FileText className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  placeholder="e.g. Diabetic, Penicillin allergy, Pacemaker"
                  className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-sm sm:text-base font-medium focus:outline-none focus:ring-2 ${
                    isYellow
                      ? 'bg-neutral-900 border-amber-400 text-amber-300 focus:ring-amber-400'
                      : 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-500'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Home Address */}
          <div>
            <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-inherit/80 mb-1.5">
              Permanent Home Address (Singapore)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600">
                <MapPin className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Blk 480 Lorong 6 Toa Payoh #10-123, Singapore 310480"
                className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-sm sm:text-base font-semibold focus:outline-none focus:ring-2 ${
                  isYellow
                    ? 'bg-neutral-900 border-amber-400 text-amber-300 focus:ring-amber-400'
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-500'
                }`}
              />
            </div>
          </div>

          {/* Section 5: Emergency Contacts Preview & Link */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-indigo-600 dark:text-amber-400" />
              <div>
                <div className="font-bold text-xs sm:text-sm">
                  {contacts.length} Emergency Contacts Configured
                </div>
                <div className="text-[11px] text-slate-500 dark:text-inherit/70">
                  {contacts.map((c) => c.name).slice(0, 2).join(', ')}...
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenManageContacts();
              }}
              className="text-xs font-bold text-indigo-600 dark:text-amber-400 hover:underline"
            >
              Edit Contacts →
            </button>
          </div>

          {/* Account Metadata / Sign Out */}
          <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-inherit/60 border-t border-slate-100 dark:border-neutral-800">
            <div>
              <span>Firestore UID: </span>
              <code className="font-mono bg-slate-100 dark:bg-neutral-800 px-1 py-0.5 rounded text-[10px]">
                {user?.uid.slice(0, 14)}...
              </code>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1 text-rose-600 hover:text-rose-700 font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between shrink-0 ${
          isYellow ? 'border-amber-400 bg-neutral-950' : 'border-slate-200 bg-slate-50'
        }`}>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-xs sm:text-sm hover:bg-slate-100 dark:border-neutral-700"
          >
            Close
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveProfile}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center gap-2 ${
              isYellow
                ? 'bg-amber-400 text-black font-extrabold hover:bg-amber-300'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            } disabled:opacity-50`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving to Firestore...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save Profile to Cloud</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
