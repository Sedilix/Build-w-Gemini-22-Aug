/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
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
} from 'lucide-react';
import {
  AccessibilitySettings,
  BloodType,
  EmergencyContact,
  SavedPlace,
  SavedPlaceKind,
} from '../types';
import { AppLogo } from './AppLogo';
import { EMERGENCY_995_CONTACT, ensureEmergency995 } from '../data/defaultContacts';
import { importContactsFromPhone, isContactPickerSupported, createManualContact } from '../utils/contacts';
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

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const stepIndex = STEP_ORDER.indexOf(step);

  const goNext = () => {
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') setSelfiePhotoUrl(result);
    };
    reader.readAsDataURL(file);
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
      {/* Progress */}
      <header className="border-line bg-surface/95 sticky top-0 z-10 border-b px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <AppLogo size={32} />
          <div className="min-w-0 flex-1">
            <div className="font-display truncate text-base font-bold sm:text-lg">Senior SafeSpot</div>
            <div className="bg-well mt-1.5 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-pine h-full rounded-full transition-all duration-300"
                style={{ width: `${((stepIndex + 1) / STEP_ORDER.length) * 100}%` }}
              />
            </div>
          </div>
          {step !== 'welcome' && (
            <button onClick={onSkip} className="text-ink-faint hover:text-ink shrink-0 text-sm font-bold">
              {t('onboard.skip', lang)}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {step === 'welcome' && (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <AppLogo size={88} />
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {t('onboard.welcomeTitle', lang)}
            </h1>
            <p className="text-ink-soft max-w-md text-lg leading-relaxed">
              {t('onboard.welcomeBody', lang)}
            </p>
            <button onClick={goNext} className="btn btn-lg btn-primary mt-2 w-full max-w-xs">
              {t('onboard.start', lang)}
              <ArrowRight className="h-5 w-5" />
            </button>
            <button onClick={onSkip} className="text-ink-faint hover:text-ink text-sm font-bold">
              {t('onboard.skip', lang)}
            </button>
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

            {/* Photo */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="border-line hover:border-pine relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed transition-colors"
                aria-label={t('onboard.photo', lang)}
              >
                {selfiePhotoUrl ? (
                  <img src={selfiePhotoUrl} alt="You" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-ink-faint flex h-full w-full items-center justify-center">
                    <Camera className="h-7 w-7" />
                  </span>
                )}
              </button>
              <div className="min-w-0">
                <div className="text-base font-bold">{t('onboard.photo', lang)}</div>
                <p className="text-ink-soft text-sm">{t('onboard.photoWhy', lang)}</p>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoPick}
                className="hidden"
              />
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

            {SAVED_PLACE_KINDS.map((kind) => (
              <div key={kind}>
                <label className="label" htmlFor={`onboard-place-${kind}`}>
                  <span aria-hidden="true">{SAVED_PLACE_META[kind].emoji}</span>{' '}
                  {SAVED_PLACE_META[kind].title}
                </label>
                <input
                  id={`onboard-place-${kind}`}
                  className="input"
                  value={places[kind]}
                  onChange={(e) => setPlaces((prev) => ({ ...prev, [kind]: e.target.value }))}
                  placeholder={SAVED_PLACE_META[kind].hint}
                />
              </div>
            ))}

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
                  className="border-line bg-well/50 flex items-center gap-3 rounded-xl border p-3"
                >
                  <span className="text-xl" aria-hidden="true">
                    {c.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-bold">{c.name}</div>
                    <div className="text-ink-soft truncate text-sm">
                      {c.relationship} · {c.phone}
                    </div>
                  </div>
                  {c.locked ? (
                    <span
                      className="text-ink-faint flex shrink-0 items-center gap-1 text-xs font-bold"
                      title={t('onboard.emergencyLocked', lang)}
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRemoveContact(c.id)}
                      className="text-brick hover:bg-brick-soft shrink-0 rounded-lg p-2 transition-colors"
                      aria-label={`Remove ${c.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
