/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Send, 
  Phone, 
  MessageSquare, 
  Share2, 
  Copy, 
  Check, 
  Navigation, 
  ExternalLink, 
  UserPlus, 
  Sparkles,
  HeartHandshake,
  Car
} from 'lucide-react';
import { EmergencyContact, LocationVerificationResult, AccessibilitySettings } from '../types';

interface OneTapSharePanelProps {
  contacts: EmergencyContact[];
  verification: LocationVerificationResult | null;
  settings: AccessibilitySettings;
  onOpenManageContacts: () => void;
  onOpenCaregiverPreview: () => void;
}

export const OneTapSharePanel: React.FC<OneTapSharePanelProps> = ({
  contacts,
  verification,
  settings,
  onOpenManageContacts,
  onOpenCaregiverPreview,
}) => {
  const [copied, setCopied] = useState(false);
  const [lastSentTo, setLastSentTo] = useState<string | null>(null);

  const isYellow = settings.contrastTheme === 'yellow-black';

  const shareUrls = verification?.shareUrls;
  const address = verification?.formattedAddress || 'My Current Location';

  const handleCopyLink = () => {
    if (!shareUrls?.googleMapsUrl) return;
    navigator.clipboard.writeText(
      `Pickup Location for Senior: ${address}\nNavigation Link: ${shareUrls.googleMapsUrl}\nInstructions: ${verification?.pickupInstructionsForDriver || 'Please pickup here'}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleNativeShare = async () => {
    if (navigator.share && shareUrls) {
      try {
        await navigator.share({
          title: 'Senior SafeSpot Live Pickup Location',
          text: `I need a pickup at: ${address}. Driver instructions: ${verification?.pickupInstructionsForDriver || ''}`,
          url: shareUrls.googleMapsUrl,
        });
      } catch (e) {
        console.warn('Share cancelled or not supported:', e);
      }
    } else {
      handleCopyLink();
    }
  };

  const triggerSendContact = (contact: EmergencyContact, channel: 'sms' | 'whatsapp' | 'call') => {
    setLastSentTo(contact.name);
    setTimeout(() => setLastSentTo(null), 4000);

    const message = encodeURIComponent(
      `Hi ${contact.name}! I need a pickup here:\n📍 ${address}\n🚗 Pickup Note: ${verification?.pickupInstructionsForDriver || 'Waiting by curb'}\n🗺️ Google Maps Navigation: ${shareUrls?.googleMapsUrl || ''}`
    );

    if (channel === 'sms') {
      const cleanPhone = contact.phone.replace(/[^0-9+]/g, '');
      window.location.href = `sms:${cleanPhone}?&body=${message}`;
    } else if (channel === 'whatsapp') {
      const cleanPhone = contact.phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
    } else if (channel === 'call') {
      const cleanPhone = contact.phone.replace(/[^0-9+]/g, '');
      window.location.href = `tel:${cleanPhone}`;
    }
  };

  return (
    <section
      id="card-one-tap-triggers"
      className={`rounded-2xl p-6 sm:p-7 border transition-all shadow-xs ${
        isYellow
          ? 'bg-black text-amber-300 border-amber-400'
          : settings.contrastTheme === 'black-white'
          ? 'bg-white text-black border-black'
          : settings.contrastTheme === 'warm-soft'
          ? 'bg-[#fffaf3] text-[#2c241c] border-[#dfd2c4]'
          : 'bg-white text-slate-900 border-slate-200/90'
      }`}
    >
      {/* Title Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isYellow ? 'bg-amber-400 text-black' : 'bg-slate-900 text-white'
          }`}>
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-none text-slate-900 dark:text-inherit">
              One-Tap Caregiver & Family Pickup
            </h3>
            <p className="text-xs sm:text-sm font-normal text-slate-500 dark:text-inherit/75 mt-1">
              Tap any contact below to immediately send your exact verified location & photo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-preview-caregiver-view"
            onClick={onOpenCaregiverPreview}
            className="accessible-tap px-3.5 py-1.5 rounded-xl font-semibold text-xs sm:text-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <Car className="w-4 h-4 text-emerald-600" />
            <span>Driver Screen</span>
          </button>

          <button
            id="btn-manage-contacts"
            onClick={onOpenManageContacts}
            className="accessible-tap px-3.5 py-1.5 rounded-xl font-semibold text-xs sm:text-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <UserPlus className="w-4 h-4 text-slate-500" />
            <span>Edit Contacts</span>
          </button>
        </div>
      </div>

      {/* Confirmation Feedback Pill */}
      {lastSentTo && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xs">
          <Check className="w-4 h-4" />
          <span>Location dispatched to {lastSentTo}!</span>
        </div>
      )}

      {/* 1-Tap Giant Emergency Contact Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
              isYellow
                ? 'bg-neutral-950 border-amber-400 text-amber-300'
                : 'bg-slate-50/70 border-slate-200/90 hover:border-slate-300 hover:bg-slate-50 text-slate-900 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl p-2 rounded-xl bg-white dark:bg-neutral-800 border border-slate-200/80 shadow-2xs">
                  {contact.emoji}
                </div>
                <div>
                  <div className="font-bold text-base sm:text-lg leading-tight text-slate-900 dark:text-inherit">
                    {contact.name}
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-inherit/70 mt-0.5">
                    {contact.phone} {contact.isPrimary && '• Primary'}
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Action Buttons per contact */}
            <div className="grid grid-cols-2 gap-2.5 mt-1">
              <button
                id={`btn-send-sms-${contact.id}`}
                onClick={() => triggerSendContact(contact, 'sms')}
                className={`giant-tap px-4 py-3 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 active:scale-98 transition-all shadow-xs ${
                  isYellow
                    ? 'bg-amber-400 text-black hover:bg-amber-300'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>Send Pin</span>
              </button>

              <button
                id={`btn-call-${contact.id}`}
                onClick={() => triggerSendContact(contact, 'call')}
                className={`giant-tap px-4 py-3 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 border active:scale-98 transition-all ${
                  isYellow
                    ? 'border-amber-400 text-amber-300 hover:bg-amber-400/10'
                    : 'border-slate-200 hover:bg-white text-slate-800 bg-white shadow-2xs'
                }`}
              >
                <Phone className="w-4 h-4 text-slate-600 dark:text-inherit" />
                <span>Call</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Universal Quick Action Row */}
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Open in Google Maps */}
        <a
          id="btn-open-google-maps-navigation"
          href={shareUrls?.googleMapsUrl || `https://www.google.com/maps`}
          target="_blank"
          rel="noopener noreferrer"
          className={`accessible-tap px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all ${
            isYellow
              ? 'border-amber-400 hover:bg-amber-400/10 text-amber-300'
              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-2xs'
          }`}
        >
          <Navigation className="w-4 h-4 text-blue-600" />
          <span>Open Maps</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-60" />
        </a>

        {/* Copy Share Details */}
        <button
          id="btn-copy-share-pin-link"
          onClick={handleCopyLink}
          className={`accessible-tap px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all ${
            isYellow
              ? 'border-amber-400 hover:bg-amber-400/10 text-amber-300'
              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-2xs'
          }`}
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
          <span>{copied ? 'Link Copied!' : 'Copy Location Link'}</span>
        </button>

        {/* Universal Share Sheet */}
        <button
          id="btn-universal-share-sheet"
          onClick={handleNativeShare}
          className={`accessible-tap px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all ${
            isYellow
              ? 'border-amber-400 hover:bg-amber-400/10 text-amber-300'
              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-2xs'
          }`}
        >
          <Share2 className="w-4 h-4 text-indigo-600" />
          <span>Share to Any App</span>
        </button>
      </div>
    </section>
  );
};
