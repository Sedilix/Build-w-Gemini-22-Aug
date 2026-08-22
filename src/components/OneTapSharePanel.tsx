/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Send, 
  Phone, 
  Copy, 
  Check, 
  Navigation, 
  ExternalLink, 
  UserPlus, 
  HeartHandshake,
  Car,
  Share2,
  Radio,
  Loader2
} from 'lucide-react';
import { EmergencyContact, LocationVerificationResult, AccessibilitySettings } from '../types';
import { t } from '../locales/translations';

interface OneTapSharePanelProps {
  contacts: EmergencyContact[];
  verification: LocationVerificationResult | null;
  settings: AccessibilitySettings;
  onOpenManageContacts: () => void;
  onOpenCaregiverPreview: () => void;
  /** Creates a Firestore incident and SMSes the /track/:id live link to family */
  onAlertFamily: () => void;
  isAlertingFamily: boolean;
}

export const OneTapSharePanel: React.FC<OneTapSharePanelProps> = ({
  contacts,
  verification,
  settings,
  onOpenManageContacts,
  onOpenCaregiverPreview,
  onAlertFamily,
  isAlertingFamily,
}) => {
  const [copied, setCopied] = useState(false);
  const [lastSentTo, setLastSentTo] = useState<string | null>(null);

  const lang = settings.language || 'en';

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
          title: 'SafeSpot.SG Live Pickup Location',
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
    <section id="card-one-tap-triggers" className="card p-6 sm:p-7">
      {/* Title Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="icon-tile">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-2xl leading-none font-bold tracking-tight">
              {t('share.title', lang)}
            </h3>
            <p className="text-ink-soft mt-1 text-sm font-normal sm:text-base">
              {t('share.subtitle', lang)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-alert-family-live-track"
            onClick={onAlertFamily}
            disabled={isAlertingFamily}
            className="btn btn-md btn-danger"
            title="Create a live tracking incident and send the link to your family"
          >
            {isAlertingFamily ? <Loader2 className="h-5 w-5 animate-spin" /> : <Radio className="h-5 w-5" />}
            <span>{t('share.alertFamily', lang)}</span>
          </button>

          <button
            id="btn-preview-caregiver-view"
            onClick={onOpenCaregiverPreview}
            className="btn btn-md btn-secondary"
          >
            <Car className="text-pine h-5 w-5" />
            <span>{t('share.driverScreen', lang)}</span>
          </button>

          <button
            id="btn-manage-contacts"
            onClick={onOpenManageContacts}
            className="btn btn-md btn-secondary"
          >
            <UserPlus className="text-ink-soft h-5 w-5" />
            <span>{t('share.editContacts', lang)}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Feedback Pill */}
      {lastSentTo && (
        <div className="btn-primary mb-4 flex items-center justify-center gap-2 rounded-xl p-3.5 text-base font-bold sm:text-lg">
          <Check className="h-5 w-5" />
          <span>Location dispatched to {lastSentTo}!</span>
        </div>
      )}

      {/* 1-Tap Giant Emergency Contact Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="border-line bg-well/50 hover:border-line-strong flex flex-col justify-between rounded-xl border p-5 transition-colors"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="border-line bg-surface text-3xl rounded-xl border p-2 shadow-xs">
                  {contact.emoji}
                </div>
                <div>
                  <div className="text-ink text-lg leading-tight font-bold sm:text-xl">
                    {contact.name}
                  </div>
                  <div className="text-ink-soft mt-0.5 text-sm font-semibold sm:text-base">
                    {contact.phone} {contact.isPrimary && '• Primary'}
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Action Buttons per contact */}
            <div className="mt-1 grid grid-cols-2 gap-2.5">
              <button
                id={`btn-send-sms-${contact.id}`}
                onClick={() => triggerSendContact(contact, 'sms')}
                className="btn btn-lg btn-primary"
              >
                <Send className="h-5 w-5" />
                <span>{t('share.sendPin', lang)}</span>
              </button>

              <button
                id={`btn-call-${contact.id}`}
                onClick={() => triggerSendContact(contact, 'call')}
                className="btn btn-lg btn-secondary"
              >
                <Phone className="text-ink-soft h-5 w-5" />
                <span>{t('share.call', lang)}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Universal Quick Action Row */}
      <div className="border-line mt-5 grid grid-cols-1 gap-2.5 border-t pt-4 sm:grid-cols-3">
        <a
          id="btn-open-google-maps-navigation"
          href={shareUrls?.googleMapsUrl || `https://www.google.com/maps`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-md btn-secondary"
        >
          <Navigation className="text-sky h-5 w-5" />
          <span>Open Maps</span>
          <ExternalLink className="h-4 w-4 opacity-60" />
        </a>

        <button
          id="btn-copy-share-pin-link"
          onClick={handleCopyLink}
          className="btn btn-md btn-secondary"
        >
          {copied ? <Check className="text-pine h-5 w-5" /> : <Copy className="text-ink-soft h-5 w-5" />}
          <span>{copied ? t('share.copied', lang) : t('share.copyLink', lang)}</span>
        </button>

        <button
          id="btn-universal-share-sheet"
          onClick={handleNativeShare}
          className="btn btn-md btn-secondary"
        >
          <Share2 className="text-sky h-5 w-5" />
          <span>Share to Any App</span>
        </button>
      </div>
    </section>
  );
};
