/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  LogIn, 
  Phone, 
  KeyRound, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles, 
  ArrowRight, 
  UserCheck, 
  Camera,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { 
  signInWithGoogle, 
  signInAsGuest, 
  setupRecaptcha, 
  sendPhoneOtp 
} from '../lib/firebase';
import { ConfirmationResult, User as FirebaseUser } from 'firebase/auth';
import { AccessibilitySettings } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: FirebaseUser) => void;
  settings: AccessibilitySettings;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  settings,
}) => {
  const [authMode, setAuthMode] = useState<'options' | 'phone_input' | 'phone_otp'>('options');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  const isYellow = settings.contrastTheme === 'yellow-black';

  useEffect(() => {
    if (!isOpen) {
      setAuthMode('options');
      setPhoneNumber('');
      setOtpCode('');
      setConfirmationResult(null);
      setErrorMessage(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const user = await signInWithGoogle();
      onAuthSuccess(user);
      onClose();
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setErrorMessage(err.message || 'Google sign-in was cancelled or failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const user = await signInAsGuest();
      onAuthSuccess(user);
      onClose();
    } catch (err: any) {
      console.error('Guest Sign-In failed:', err);
      setErrorMessage(err.message || 'Guest sign-in failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setErrorMessage('Please enter your mobile phone number.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const verifier = setupRecaptcha('recaptcha-container-auth');
      const confirmation = await sendPhoneOtp(phoneNumber, verifier);
      setConfirmationResult(confirmation);
      setAuthMode('phone_otp');
    } catch (err: any) {
      console.error('Phone OTP request failed:', err);
      setErrorMessage(err.message || 'Failed to send SMS verification code. Please check the phone number.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || !confirmationResult) {
      setErrorMessage('Please enter the 6-digit code received via SMS.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const credential = await confirmationResult.confirm(otpCode.trim());
      if (credential.user) {
        onAuthSuccess(credential.user);
        onClose();
      }
    } catch (err: any) {
      console.error('OTP confirmation failed:', err);
      setErrorMessage('Invalid verification code. Please check the SMS and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="modal-auth-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
    >
      <div 
        id="modal-auth-content"
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden my-auto flex flex-col transition-all ${
          isYellow
            ? 'bg-black text-amber-300 border-amber-400'
            : settings.contrastTheme === 'black-white'
            ? 'bg-white text-black border-black'
            : 'bg-white text-slate-900 border-slate-200'
        }`}
      >
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between shrink-0 ${
          isYellow
            ? 'border-amber-400 bg-neutral-950'
            : 'border-slate-200/90 bg-slate-50/80'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              isYellow ? 'bg-amber-400 text-black' : 'bg-slate-900 text-white'
            }`}>
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-none">
                Sign In & User Profile
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-inherit/70 mt-1">
                Save your medical ID, emergency contacts & selfie in Cloud
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="accessible-tap p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition-all"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode 1: Main Selection (Google or Phone) */}
          {authMode === 'options' && (
            <div className="space-y-3.5">
              {/* Option 1: Continue with Google */}
              <button
                id="btn-auth-google"
                type="button"
                disabled={isLoading}
                onClick={handleGoogleSignIn}
                className={`giant-tap w-full p-4 rounded-xl font-bold text-base sm:text-lg border-2 transition-all flex items-center justify-center gap-3 active:scale-98 ${
                  isYellow
                    ? 'border-amber-400 bg-neutral-900 text-amber-300 hover:bg-neutral-800'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800 shadow-sm'
                }`}
              >
                {/* Google Icon SVG */}
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Option 2: Sign in with Phone & SMS OTP */}
              <button
                id="btn-auth-phone-start"
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setErrorMessage(null);
                  setAuthMode('phone_input');
                }}
                className={`giant-tap w-full p-4 rounded-xl font-bold text-base sm:text-lg border-2 transition-all flex items-center justify-center gap-3 active:scale-98 ${
                  isYellow
                    ? 'border-amber-400 bg-amber-400 text-black font-extrabold hover:bg-amber-300'
                    : 'border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                }`}
              >
                <Phone className="w-5 h-5" />
                <span>Sign In / Up with Phone (SMS OTP)</span>
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleGuestSignIn}
                  className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-inherit/70 hover:underline"
                >
                  ⚡ Instant Access (Continue as Guest)
                </button>
              </div>
            </div>
          )}

          {/* Mode 2: Phone Input */}
          {authMode === 'phone_input' && (
            <form onSubmit={handleSendPhoneOtp} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-inherit/80 mb-1.5">
                  Mobile Phone Number (Singapore / International)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 9123 4567 or +65 9123 4567"
                    className={`w-full pl-11 pr-4 py-3.5 rounded-xl border text-base sm:text-lg font-semibold focus:outline-none focus:ring-2 ${
                      isYellow
                        ? 'bg-neutral-900 border-amber-400 text-amber-300 focus:ring-amber-400'
                        : 'bg-white border-slate-300 text-slate-900 focus:ring-emerald-500'
                    }`}
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-inherit/60 mt-1">
                  We will send a 6-digit SMS verification code to confirm your number.
                </p>
              </div>

              {/* Invisible Recaptcha target container */}
              <div id="recaptcha-container-auth" ref={recaptchaContainerRef}></div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('options')}
                  className="py-3 px-4 rounded-xl border border-slate-300 font-semibold text-xs sm:text-sm hover:bg-slate-100 dark:border-neutral-700"
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={isLoading || !phoneNumber.trim()}
                  className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all ${
                    isYellow
                      ? 'bg-amber-400 text-black font-extrabold hover:bg-amber-300'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  } disabled:opacity-50`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending SMS Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Verification Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Mode 3: OTP Code Verification */}
          {authMode === 'phone_otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-inherit/80 mb-1.5">
                  Enter 6-Digit SMS Verification Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className={`w-full pl-11 pr-4 py-3.5 rounded-xl border text-xl sm:text-2xl font-mono tracking-widest text-center focus:outline-none focus:ring-2 ${
                      isYellow
                        ? 'bg-neutral-900 border-amber-400 text-amber-300 focus:ring-amber-400'
                        : 'bg-white border-slate-300 text-slate-900 focus:ring-emerald-500'
                    }`}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-inherit/60 mt-1">
                  Sent to: <strong className="text-slate-800 dark:text-inherit">{phoneNumber}</strong>
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('phone_input')}
                  className="py-3 px-4 rounded-xl border border-slate-300 font-semibold text-xs sm:text-sm hover:bg-slate-100 dark:border-neutral-700"
                >
                  Change Number
                </button>

                <button
                  type="submit"
                  disabled={isLoading || otpCode.length < 6}
                  className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all ${
                    isYellow
                      ? 'bg-amber-400 text-black font-extrabold hover:bg-amber-300'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  } disabled:opacity-50`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify & Continue</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
