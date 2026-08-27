import React from 'react';
import { type Tone } from './tokens.ts';

interface BannerProps {
  title: string;
  message?: React.ReactNode;
  tone?: Tone;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
}

/** Full-bleed strip pinned above page content. Unifies the three announcement banners. */
const BANNER_TONE: Record<Tone, { bg: string; border: string; accent: string; body: string }> = {
  info:    { bg: 'bg-indigo-900/90',     border: 'border-indigo-500',     accent: 'text-indigo-400',  body: 'text-indigo-200/80' },
  success: { bg: 'bg-green-900/90',      border: 'border-green-500',      accent: 'text-green-400',   body: 'text-green-200/80' },
  warning: { bg: 'bg-amber-900/90',      border: 'border-amber-500',      accent: 'text-amber-400',   body: 'text-amber-200/80' },
  danger:  { bg: 'bg-primary-red/20',    border: 'border-primary-red',    accent: 'text-primary-red', body: 'text-ghost-white/80' },
  neutral: { bg: 'bg-accent-gray/90',    border: 'border-pure-white/20',  accent: 'text-highlight-silver', body: 'text-highlight-silver' },
};

export const Banner: React.FC<BannerProps> = ({
  title, message, tone = 'info', icon: Icon, onDismiss, action, className = '',
}) => {
  const t = BANNER_TONE[tone];
  return (
    <div className={`${t.bg} ${t.border} backdrop-blur-md text-pure-white px-4 py-3 shadow-lg border-b-2 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in-down ${className}`}>
      <div className="flex items-center gap-4 text-center sm:text-left">
        {Icon && (
          <div className="hidden sm:block p-2 rounded-full bg-pure-white/10 border border-pure-white/10">
            <Icon className={`w-6 h-6 ${t.accent}`} />
          </div>
        )}
        <div>
          <h3 className="font-bold text-base leading-tight">{title}</h3>
          {message && <p className={`text-xs mt-1 italic ${t.body}`}>{message}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
        {action}
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 bg-transparent hover:bg-pure-white/10 text-pure-white rounded-full p-2 transition-colors ml-auto sm:ml-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
