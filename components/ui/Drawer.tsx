import React, { useEffect } from 'react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Panel width on desktop. Mobile always takes the full screen. */
  width?: 'md' | 'lg';
}

const WIDTH = { md: 'md:max-w-md', lg: 'md:max-w-2xl' } as const;

/**
 * Slide-over panel: full screen on mobile, anchored to the right edge on desktop.
 *
 * Distinct from `Sheet` on purpose. A Sheet is for making a choice and getting out of the
 * way; a Drawer is for reference material you read *beside* the thing that prompted it —
 * scoring rules next to the standings they explain.
 */
export const Drawer: React.FC<DrawerProps> = ({
  isOpen, onClose, title, subtitle, children, width = 'lg',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex justify-end bg-carbon-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full ${WIDTH[width]} h-full bg-accent-gray border-l border-pure-white/10 shadow-2xl flex flex-col animate-fade-in-down md:animate-none`}
      >
        <div className="shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-pure-white/10">
          <div className="min-w-0">
            {title && (
              <h2 className="text-lg font-black uppercase italic tracking-wide text-pure-white truncate">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-[11px] uppercase tracking-wider text-highlight-silver/80 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-2 text-highlight-silver hover:text-pure-white hover:bg-pure-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
};
