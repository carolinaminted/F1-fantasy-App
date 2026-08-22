import React, { useState } from 'react';
import { updateUserProfile } from '../../services/firestoreService.ts';
import { validateDisplayName, validateRealName, sanitizeString } from '../../services/validation.ts';
import type { User } from '../../types.ts';

interface EditProfileFormProps {
  user: User;
  onDone: () => void;
}

const FIELD_CLASS =
  'w-full rounded border border-pure-white/15 bg-carbon-black p-2 text-pure-white focus:border-primary-red focus:outline-none';

/**
 * The account-edit form, extracted in Gate 12. Validation and the `updateUserProfile`
 * write are exactly what ProfilePage did inline; email stays read-only.
 */
export const EditProfileForm: React.FC<EditProfileFormProps> = ({ user, onDone }) => {
  const [form, setForm] = useState({
    displayName: user.displayName,
    email: user.email,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fn = validateRealName(form.firstName, 'First Name');
    if (!fn.valid) return setError(fn.error!);
    const ln = validateRealName(form.lastName, 'Last Name');
    if (!ln.valid) return setError(ln.error!);
    const dn = validateDisplayName(form.displayName);
    if (!dn.valid) return setError(dn.error!);

    setIsSaving(true);
    try {
      await updateUserProfile(user.id, {
        displayName: sanitizeString(form.displayName),
        email: form.email, // read-only in the UI; kept in the payload for the backend flow
        firstName: sanitizeString(form.firstName),
        lastName: sanitizeString(form.lastName),
      });
      onDone();
    } catch (err) {
      console.error(err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
            First Name
          </label>
          <input
            type="text" required maxLength={50} placeholder="Required"
            value={form.firstName}
            onChange={e => setForm(prev => ({ ...prev, firstName: e.target.value }))}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
            Last Name
          </label>
          <input
            type="text" required maxLength={50} placeholder="Required"
            value={form.lastName}
            onChange={e => setForm(prev => ({ ...prev, lastName: e.target.value }))}
            className={FIELD_CLASS}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
          Display Name (Max 20)
        </label>
        <input
          type="text" required maxLength={20}
          value={form.displayName}
          onChange={e => setForm(prev => ({ ...prev, displayName: e.target.value }))}
          className={FIELD_CLASS}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
          Email Address
        </label>
        <input
          type="email" readOnly value={form.email}
          className="w-full cursor-not-allowed rounded border border-pure-white/15 bg-carbon-black/50 p-2 text-highlight-silver outline-none"
        />
        <p className="mt-1 text-[10px] italic text-highlight-silver/50">
          Email cannot be changed after registration.
        </p>
      </div>

      {error && <p className="text-center text-sm text-primary-red">{error}</p>}

      <div className="flex justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded border border-pure-white/15 px-4 py-2 text-sm font-bold text-highlight-silver transition-colors hover:border-highlight-silver hover:text-pure-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded bg-primary-red px-4 py-2 text-sm font-bold text-pure-white transition-colors hover:bg-red-600 disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};
