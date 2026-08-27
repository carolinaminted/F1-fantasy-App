import React, { useEffect } from 'react';
import { Banner } from '../ui/index.ts';

/**
 * Dirty-state guard for the two admin tools that stage every edit in local React state and
 * only write on save (Scoring Rules, Drivers & Teams).
 *
 * Before this, retiring five drivers and walking away lost all of it silently: no warning,
 * no indicator, and the save control was an unlabelled icon. The hook supplies both halves
 * of the fix — a visible banner while changes are pending, and a confirm before leaving.
 */
export const useUnsavedChanges = (isDirty: boolean) => {
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Browsers show their own wording; a non-empty returnValue is what triggers it.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  /** Wire to AdminToolShell's `onBeforeLeave`; returns false to stay on the page. */
  const confirmLeave = () =>
    !isDirty || window.confirm('You have unsaved changes. Leave without saving?');

  return { confirmLeave };
};

interface UnsavedChangesBannerProps {
  isDirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saving?: boolean;
  /** What is pending, e.g. "3 drivers changed". */
  summary?: string;
}

export const UnsavedChangesBanner: React.FC<UnsavedChangesBannerProps> = ({
  isDirty, onSave, onDiscard, saving, summary,
}) => {
  if (!isDirty) return null;

  return (
    <Banner
      tone="warning"
      title="You have unsaved changes"
      message={summary ?? 'Nothing is saved until you choose Save changes.'}
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={onDiscard}
            disabled={saving}
            className="rounded-lg border border-pure-white/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-pure-white transition-colors hover:bg-pure-white/10 disabled:opacity-40"
          >
            Discard
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-pure-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-carbon-black transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      }
    />
  );
};
