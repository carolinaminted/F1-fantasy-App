import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** What being ON actually means, in one short line. */
  description?: string;
  disabled?: boolean;
  /** Explains the disabled state — e.g. "You can't remove your own admin access." */
  disabledReason?: string;
  tone?: 'neutral' | 'danger';
}

/**
 * A labelled on/off switch. The kit has no equivalent because no member surface needs one;
 * three admin pages each hand-rolled their own from `sr-only` checkboxes.
 *
 * The switch commits on change — there is no separate Save step to forget. Pages that need
 * a confirmation put a ConfirmModal in front of `onChange`.
 */
export const Toggle: React.FC<ToggleProps> = ({
  checked, onChange, label, description, disabled, disabledReason, tone = 'neutral',
}) => {
  const onColor = tone === 'danger' ? 'bg-primary-red' : 'bg-green-500';

  return (
    <div className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-60' : ''}`}>
      <div className="min-w-0">
        <span className="block text-sm font-bold text-pure-white">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-highlight-silver">
            {description}
          </span>
        )}
        {disabled && disabledReason && (
          <span className="mt-1 block text-xs italic text-amber-400">{disabledReason}</span>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked ? `${onColor} border-transparent` : 'border-pure-white/20 bg-carbon-black'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {/*
          `left-0.5` is load-bearing. A <button> centres its content, so an absolutely
          positioned child with `left: auto` takes its static position at the centre of the
          track — and the translate for the "on" state then carried the knob off the right
          edge. Anchoring it to the left makes the travel distance mean what it says:
          44px track - 2px border - 18px knob - 2px inset = 22px.
        */}
        <span
          className={`absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-pure-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[22px]' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
