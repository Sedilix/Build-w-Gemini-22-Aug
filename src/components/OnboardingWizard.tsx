/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Camera,
  Lock,
  Plus,
  Trash2,
  UserRound,
  BookUser,
  Star,
} from 'lucide-react';
import {
  AccessibilitySettings,
  BloodType,
  EmergencyContact,
  SavedPlace,
  SavedPlaceKind,
} from '../types';
import { AppLogo } from './AppLogo';
import { AddressAutocompleteInput } from './AddressAutocompleteInput';
import { EMERGENCY_995_CONTACT, ensureEmergency995 } from '../data/defaultContacts';
import { importContactsFromPhone, isContactPickerSupported, createManualContact, getPreferredContact, setPreferredContact } from '../utils/contacts';
import { SAVED_PLACE_KINDS, SAVED_PLACE_META } from '../utils/places';
import { t } from '../locales/translations';

const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

export interface OnboardingResult {
  actualName: string;
  phone: string;
  dob: string;
  bloodType: BloodType;
  selfiePhotoUrl?: string;
  savedPlaces: SavedPlace[];
  contacts: EmergencyContact[];
}

interface OnboardingWizardProps {
  settings: AccessibilitySettings;
  existingContacts: EmergencyContact[];
  onComplete: (result: OnboardingResult) => void;
  onSkip: () => void;
}

type Step = 'welcome' | 'profile' | 'places' | 'contacts';

const STEP_ORDER: Step[] = ['welcome', 'profile', 'places', 'contacts'];

/**
 * First-launch setup. A senior in distress should never be entering their
 * blood type or a daughter's phone number, so everything the emergency flow
 * needs is collected once, up front, before the app is usable.
 */
export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  settings,
  existingContacts,
  onComplete,
  onSkip,
}) => {
  const lang = settings.language || 'en';

  const [step, setStep] = useState<Step>('welcome');
  const [actualName, setActualName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [bloodType, setBloodType] = useState<BloodType>('Unknown');
  const [selfiePhotoUrl, setSelfiePhotoUrl] = useState<string | undefined>();
  const [places, setPlaces] = useState<Record<SavedPlaceKind, string>>({
    home: '',
    work: '',
    healthcare: '',
  });
  const [providerType, setProviderType] = useState<'public' | 'private'>('public');

  // 995 is seeded from the start so the list is never empty of help.
  const [contacts, setContacts] = useState<EmergencyContact[]>(() =>
    ensureEmergency995(existingContacts)
  );
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [importNote, setImportNote] = useState<string | null>(null);

  // Live selfie capture only — gallery uploads are deliberately absent so the
  // photo responders see is always authentic and current.
  const [isSelfieCameraOn, setIsSelfieCameraOn] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const selfieVideoRef = useRef<HTMLVideoElement | null>(null);
  const selfieStreamRef = useRef<MediaStream | null>(null);

  const stepIndex = STEP_ORDER.indexOf(step);

  const goNext = () => {
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const stopSelfieCamera = () => {
    selfieStreamRef.current?.getTracks().forEach((track) => track.stop());
    selfieStreamRef.current = null;
    setIsSelfieCameraOn(false);
  };

  const startSelfieCamera = async () => {
    try {
      setCameraUnavailable(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      selfieStreamRef.current = stream;
      setIsSelfieCameraOn(true);
    } catch (err) {
      console.warn('Selfie camera unavailable:', err);
      setIsSelfieCameraOn(false);
      setCameraUnavailable(true);
    }
  };

  // Attach the stream once the <video> tile is mounted.
  useEffect(() => {
    if (isSelfieCameraOn && selfieVideoRef.current && selfieStreamRef.current) {
      selfieVideoRef.current.srcObject = selfieStreamRef.current;
      void selfieVideoRef.current.play().catch(() => {});
    }
  }, [isSelfieCameraOn]);

  // Release the camera when the wizard unmounts.
  useEffect(() => stopSelfieCamera, []);

  const captureSelfie = () => {
    const video = selfieVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const vWidth = video.videoWidth || 400;
    const vHeight = video.videoHeight || 400;
    const minDim = Math.min(vWidth, vHeight);
    ctx.drawImage(video, (vWidth - minDim) / 2, (vHeight - minDim) / 2, minDim, minDim, 0, 0, 400, 400);
    setSelfiePhotoUrl(canvas.toDataURL('image/jpeg', 0.85));
    stopSelfieCamera();
  };
  const handleImportContacts = async () => {
    const result = await importContactsFromPhone(contacts);

    if (result.error) {
      setImportNote(result.error);
      return;
    }

    if (result.imported.length === 0) {
      setImportNote(
        result.duplicates > 0 ? 'Those contacts are already saved.' : 'No contacts were chosen.'
      );
      return;
    }

    setContacts((prev) => ensureEmergency995([...prev, ...result.imported]));
    setImportNote(
      `Added ${result.imported.length} contact${result.imported.length === 1 ? '' : 's'}` +
        (result.duplicates > 0 ? `, skipped ${result.duplicates} already saved.` : '.')
    );
  };

  const handleAddManualContact = () => {
    if (!newName.trim() || !newPhone.trim()) return;
    const contact = createManualContact(newName, newPhone, contacts.length);
    setContacts((prev) => ensureEmergency995([...prev, contact]));
    setNewName('');
    setNewPhone('');
    setImportNote(null);
  };

  const handleRemoveContact = (id: string) => {
    // Locked entries (995) are filtered back in by ensureEmergency995 anyway,
    // but the button is not offered for them in the first place.
    setContacts((prev) => ensureEmergency995(prev.filter((c) => c.id !== id)));
  };

  const handleFinish = () => {
    const savedPlaces: SavedPlace[] = SAVED_PLACE_KINDS.filter((kind) => places[kind].trim()).map(
      (kind) => ({
        kind,
        address: places[kind].trim(),
        ...(kind === 'healthcare' ? { providerType } : {}),
      })
    );

    onComplete({
      actualName: actualName.trim(),
      phone: phone.trim(),
      dob: dob.trim(),
      bloodType,
      selfiePhotoUrl,
      savedPlaces,
      contacts: ensureEmergency995(contacts),
    });
  };

  return (
    <div className="bg-bg text-ink flex min-h-dvh flex-col">
      {/* Progress Header — only shown on steps 2-4, padded safely below iOS/Android status bar */}
      {step !== 'welcome' && (
        <header className="border-line bg-surface/95 sticky top-0 z-10 border-b px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] backdrop-blur-md sm:px-6">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="text-ink-soft hover:bg-well hover:text-ink -ml-1 rounded-xl p-1.5 transition-colors"
              aria-label={t('onboard.back', lang)}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-xs font-bold text-ink-soft mb-1">
                <span className="truncate">
                  {step === 'profile' ? t('onboard.stepProfile', lang) : step === 'places' ? t('onboard.stepPlaces', lang) : t('onboard.stepContacts', lang)}
                </span>
                <span className="shrink-0">{stepIndex} / {STEP_ORDER.length - 1}</span>
              </div>
              <div className="bg-well h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-pine h-full rounded-full transition-all duration-300"
                  style={{ width: `${(stepIndex / (STEP_ORDER.length - 1)) * 100}%` }}
                />
              </div>
            </div>

            <button onClick={onSkip} className="text-ink-faint hover:text-ink shrink-0 text-sm font-bold pl-1">
              {t('onboard.skip', lang)}
            </button>
          </div>
        </header>
      )}

      <main className={`mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8 ${step === 'welcome' ? 'pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] flex flex-col justify-center' : ''}`}>
        {step === 'welcome' && (
          <div className="flex flex-col items-center gap-6 py-6 text-center">
            <AppLogo size={96} />
            <div className="space-y-2">
              <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight text-ink">
                {t('onboard.welcomeTitle', lang)}
              </h1>
              <p className="text-ink-soft max-w-md text-base sm:text-lg leading-relaxed mx-auto">
                {t('onboard.welcomeBody', lang)}
              </p>
            </div>
            <div className="w-full max-w-xs space-y-3 pt-2">
              <button onClick={goNext} className="btn btn-lg btn-primary w-full shadow-lg">
                {t('onboard.start', lang)}
                <ArrowRight className="h-5 w-5" />
              </button>
              <button onClick={onSkip} className="text-ink-faint hover:text-ink text-sm font-bold block w-full py-1">
                {t('onboard.skip', lang)}
              </button>
            </div>
          </div>
        )}

        {step === 'profile' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                {t('onboard.stepProfile', lang)}
              </h2>
              <p className="text-ink-soft mt-1 text-sm sm:text-base">
                Paramedics and drivers see this when you send an alert.
              </p>
            </div>

            {/* Photo — live capture only; no gallery upload so the photo a
                responder sees is always authentic and current. */}
            <div className="flex items-center gap-4">
              <div className="border-line bg-well relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2">
                {isSelfieCameraOn ? (
                  <video
                    ref={selfieVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                ) : selfiePhotoUrl ? (
                  <img src={selfiePhotoUrl} alt="You" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-ink-faint flex h-full w-full items-center justify-center">
                    <Camera className="h-7 w-7" />
                  </span>
                )}
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="text-base font-bold">{t('onboard.photo', lang)}</div>
                <p className="text-ink-soft text-sm">{t('onboard.photoWhy', lang)}</p>
                <div className="flex flex-wrap gap-2">
                  {isSelfieCameraOn ? (
                    <>
                      <button type="button" onClick={captureSelfie} className="btn btn-md btn-primary">
                        <Camera className="h-4 w-4" />
                        {t('onboard.takeSelfie', lang)}
                      </button>
                      <button type="button" onClick={stopSelfieCamera} className="btn btn-md btn-secondary">
                        {t('onboard.back', lang)}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startSelfieCamera()}
                      className="btn btn-md btn-primary"
                    >
                      <Camera className="h-4 w-4" />
                      {selfiePhotoUrl ? t('onboard.retakeSelfie', lang) : t('onboard.takeSelfie', lang)}
                    </button>
                  )}
                </div>
                {cameraUnavailable && (
                  <p className="text-ochre-deep text-xs font-semibold">
                    {t('onboard.cameraUnavailable', lang)}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="onboard-name">
                {t('onboard.name', lang)}
              </label>
              <input
                id="onboard-name"
                className="input"
                value={actualName}
                onChange={(e) => setActualName(e.target.value)}
                placeholder="Tan Ah Kow"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="label" htmlFor="onboard-phone">
                {t('onboard.phone', lang)}
              </label>
              <input
                id="onboard-phone"
                className="input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9123 4567"
                autoComplete="tel"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="onboard-dob">
                  {t('onboard.dob', lang)}
                </label>
                <input
                  id="onboard-dob"
                  className="input"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="onboard-blood">
                  {t('onboard.bloodType', lang)}
                </label>
                <select
                  id="onboard-blood"
                  className="input"
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value as BloodType)}
                >
                  {BLOOD_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 'places' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                {t('onboard.stepPlaces', lang)}
              </h2>
              <p className="text-ink-soft mt-1 text-sm sm:text-base">
                Saved places become one-tap pickup buttons. You can change them later.
              </p>
            </div>

            <div className="space-y-4">
              {SAVED_PLACE_KINDS.map((kind) => (
                <div key={kind} className="space-y-1.5">
                  <AddressAutocompleteInput
                    id={`onboard-place-${kind}`}
                    value={places[kind]}
                    category={kind}
                    label={SAVED_PLACE_META[kind].title}
                    emoji={SAVED_PLACE_META[kind].emoji}
                    placeholder={
                      kind === 'home'
                        ? 'e.g. 356 Yishun Ring Rd or S760356'
                        : kind === 'work'
                        ? 'e.g. BLOCK71, 71 Ayer Rajah Crescent'
                        : 'e.g. Tan Tock Seng Hospital or Yishun Polyclinic'
                    }
                    onChange={(addr, suggestion) => {
                      setPlaces((prev) => ({ ...prev, [kind]: addr }));
                      if (kind === 'healthcare' && suggestion?.providerType) {
                        setProviderType(suggestion.providerType);
                      }
                    }}
                  />

                  {/* Quick-pick recommendations for Healthcare */}
                  {kind === 'healthcare' && !places.healthcare && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-xs text-ink-faint font-semibold self-center mr-1">Popular:</span>
                      {[
                        { name: 'SGH', full: 'Outram Rd, Singapore 169608', type: 'public' },
                        { name: 'TTSH', full: '11 Jalan Tan Tock Seng, Singapore 308433', type: 'public' },
                        { name: 'NUH', full: '5 Lower Kent Ridge Rd, Singapore 119074', type: 'public' },
                        { name: 'KTPH', full: '90 Yishun Central, Singapore 768828', type: 'public' },
                        { name: 'Mt Elizabeth', full: '3 Mount Elizabeth, Singapore 228510', type: 'private' },
                      ].map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => {
                            setPlaces((prev) => ({ ...prev, healthcare: item.full }));
                            setProviderType(item.type as 'public' | 'private');
                          }}
                          className="chip bg-well hover:bg-pine-soft hover:text-pine text-ink text-xs font-semibold py-1 px-2.5 transition-colors"
                        >
                          🏥 {item.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick-pick recommendations for Work */}
                  {kind === 'work' && !places.work && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-xs text-ink-faint font-semibold self-center mr-1">Popular:</span>
                      {[
                        { name: 'BLOCK71', full: '71 Ayer Rajah Crescent, Singapore 139951' },
                        { name: 'LaunchPad', full: 'LaunchPad @ one-north, Singapore 139951' },
                        { name: 'MBFC', full: '10 Marina Blvd, Singapore 018983' },
                        { name: 'Suntec City', full: '7 Temasek Blvd, Singapore 038987' },
                      ].map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => setPlaces((prev) => ({ ...prev, work: item.full }))}
                          className="chip bg-well hover:bg-sky-soft hover:text-sky text-ink text-xs font-semibold py-1 px-2.5 transition-colors"
                        >
                          💼 {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div>
              <span className="label">Preferred healthcare provider type</span>
              <div className="flex gap-2">
                {(['public', 'private'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setProviderType(type)}
                    className={`btn btn-md flex-1 capitalize ${
                      providerType === type ? 'btn-primary' : 'btn-secondary'
                    }`}
                  >
                    {providerType === type && <Check className="h-4 w-4" />}
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'contacts' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                {t('onboard.stepContacts', lang)}
              </h2>
              <p className="text-ink-soft mt-1 text-sm sm:text-base">
                {t('onboard.emergencyLocked', lang)}
              </p>
            </div>

            {/* Preferred Contact Explanation Banner */}
            <div className="rounded-xl border border-pine/30 bg-pine-soft p-3.5 text-pine-deep flex items-start gap-2.5 text-xs sm:text-sm">
              <Star className="h-5 w-5 shrink-0 fill-pine text-pine mt-0.5" />
              <div>
                <span className="font-bold">⭐ Preferred Pick-Up Contact: </span>
                <span>When you tap <strong>"Pick Me Up Here"</strong>, your live Google Maps pin, verified address, and driver pickup note are instantly sent to this person.</span>
              </div>
            </div>

            {/* Import from the phone's address book where the browser allows it */}
            {isContactPickerSupported() && (
              <button onClick={handleImportContacts} className="btn btn-lg btn-secondary w-full">
                <BookUser className="h-5 w-5" />
                {t('onboard.importContacts', lang)}
              </button>
            )}

            {importNote && <p className="text-ink-soft text-sm font-semibold">{importNote}</p>}

            {/* Current list */}
            <ul className="space-y-2">
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 transition-all ${
                    c.isPrimary && !c.locked
                      ? 'border-pine bg-pine-soft/40 shadow-sm'
                      : 'border-line bg-well/50'
                  }`}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {c.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-base font-bold text-ink">{c.name}</span>
                      {c.isPrimary && !c.locked && (
                        <span className="chip border-pine/50 bg-pine-soft text-pine-deep text-xs font-bold py-0.5 px-2">
                          <Star className="h-3 w-3 fill-pine text-pine" />
                          Preferred
                        </span>
                      )}
                    </div>
                    <div className="text-ink-soft truncate text-sm">
                      {c.relationship} · {c.phone}
                    </div>
                  </div>

                  {c.locked ? (
                    <span
                      className="text-ink-faint flex shrink-0 items-center gap-1 text-xs font-bold px-2"
                      title={t('onboard.emergencyLocked', lang)}
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!c.isPrimary ? (
                        <button
                          type="button"
                          onClick={() => setContacts(prev => setPreferredContact(prev, c.id))}
                          className="text-xs font-bold text-ink-soft hover:text-pine hover:bg-pine-soft/50 border border-line rounded-lg px-2 py-1.5 flex items-center gap-1 transition-colors"
                          title="Set as preferred pickup recipient"
                        >
                          <Star className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Set Preferred</span>
                        </button>
                      ) : null}

                      <button
                        onClick={() => handleRemoveContact(c.id)}
                        className="text-brick hover:bg-brick-soft rounded-lg p-2 transition-colors"
                        aria-label={`Remove ${c.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Manual fallback, always available */}
            <div className="border-line space-y-3 rounded-xl border border-dashed p-3">
              <div className="text-ink-soft flex items-center gap-2 text-sm font-bold">
                <UserRound className="h-4 w-4" />
                {t('onboard.addManually', lang)}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  className="input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name"
                  aria-label="Contact name"
                />
                <input
                  className="input"
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="9123 4567"
                  aria-label="Contact phone number"
                />
              </div>
              <button
                onClick={handleAddManualContact}
                disabled={!newName.trim() || !newPhone.trim()}
                className="btn btn-md btn-secondary w-full"
              >
                <Plus className="h-4 w-4" />
                Add contact
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Navigation */}
      {step !== 'welcome' && (
        <footer className="border-line bg-surface/95 sticky bottom-0 border-t px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <button onClick={goBack} className="btn btn-lg btn-secondary shrink-0">
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden sm:inline">{t('onboard.back', lang)}</span>
            </button>

            {step === 'contacts' ? (
              <button onClick={handleFinish} className="btn btn-lg btn-primary flex-1">
                <Check className="h-5 w-5" />
                {t('onboard.finish', lang)}
              </button>
            ) : (
              <button onClick={goNext} className="btn btn-lg btn-primary flex-1">
                {t('onboard.next', lang)}
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};

export { EMERGENCY_995_CONTACT };
