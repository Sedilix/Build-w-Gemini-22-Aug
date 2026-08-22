/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Plus, Trash2, Check, UserPlus, Phone, Sparkles } from 'lucide-react';
import { EmergencyContact, AccessibilitySettings } from '../types';

interface ManageContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: EmergencyContact[];
  onSaveContacts: (contacts: EmergencyContact[]) => void;
  settings: AccessibilitySettings;
}

export const ManageContactsModal: React.FC<ManageContactsModalProps> = ({
  isOpen,
  onClose,
  contacts,
  onSaveContacts,
  settings,
}) => {
  const [list, setList] = useState<EmergencyContact[]>(contacts);
  const [newName, setNewName] = useState('');
  const [newRelationship, setNewRelationship] = useState('Daughter');
  const [newPhone, setNewPhone] = useState('');
  const [newEmoji, setNewEmoji] = useState('👩‍💼');

  if (!isOpen) return null;

  const isYellow = settings.contrastTheme === 'yellow-black';

  const handleAdd = () => {
    if (!newName.trim() || !newPhone.trim()) return;

    const newContact: EmergencyContact = {
      id: `contact-${Date.now()}`,
      name: `${newName.trim()} (${newRelationship})`,
      relationship: newRelationship,
      phone: newPhone.trim(),
      emoji: newEmoji,
      bgColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      isPrimary: false,
    };

    const updated = [...list, newContact];
    setList(updated);
    onSaveContacts(updated);
    setNewName('');
    setNewPhone('');
  };

  const handleDelete = (id: string) => {
    const updated = list.filter((c) => c.id !== id);
    setList(updated);
    onSaveContacts(updated);
  };

  return (
    <div
      id="modal-manage-contacts"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 sm:p-8 border transition-all shadow-2xl ${
          isYellow
            ? 'bg-black text-amber-300 border-amber-400'
            : 'bg-white text-slate-900 border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-neutral-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-none text-slate-900 dark:text-inherit">
                Emergency & Family Contacts
              </h3>
              <p className="text-xs sm:text-sm font-normal text-slate-500 dark:text-inherit/75 mt-1">
                Customize who receives your 1-tap pickup alerts
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="accessible-tap p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Existing Contacts List */}
        <div className="space-y-2.5 mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-inherit/70 mb-2">
            Current Contacts ({list.length})
          </div>
          {list.map((c) => (
            <div
              key={c.id}
              className="p-3.5 rounded-xl border flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-neutral-900 border-slate-200/90 shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl p-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-slate-200/80">{c.emoji}</span>
                <div>
                  <div className="font-bold text-sm sm:text-base leading-tight text-slate-900 dark:text-white">
                    {c.name}
                  </div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">
                    {c.phone}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDelete(c.id)}
                className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                title="Remove Contact"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add New Contact Form */}
        <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/50 dark:bg-neutral-950 mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-inherit/80 mb-3">
            Add New Family Member or Caregiver
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-inherit/80 block mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. John, Dr. Smith"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-inherit/80 block mb-1">Relationship</label>
                <select
                  value={newRelationship}
                  onChange={(e) => setNewRelationship(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                >
                  <option value="Daughter">Daughter</option>
                  <option value="Son">Son</option>
                  <option value="Caregiver">Caregiver</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Neighbor">Neighbor</option>
                  <option value="Doctor">Doctor</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-inherit/80 block mb-1">Emoji Icon</label>
                <select
                  value={newEmoji}
                  onChange={(e) => setNewEmoji(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                >
                  <option value="👩‍💼">👩‍💼 Daughter</option>
                  <option value="👨‍💼">👨‍💼 Son</option>
                  <option value="🩺">🩺 Caregiver / Nurse</option>
                  <option value="❤️">❤️ Spouse / Partner</option>
                  <option value="🏡">🏡 Neighbor</option>
                  <option value="🚗">🚗 Driver / Friend</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-inherit/80 block mb-1">Phone Number (Singapore / International)</label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+65 9123 4567 or 91234567"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>

            <button
              onClick={handleAdd}
              disabled={!newName.trim() || !newPhone.trim()}
              className="giant-tap w-full px-4 py-3 rounded-xl font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add to One-Tap List</span>
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="giant-tap w-full px-5 py-3 rounded-xl font-semibold border border-slate-200 bg-white dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-800 shadow-2xs transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
};
