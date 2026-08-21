import React, { useEffect } from 'react';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Caps height so long option lists scroll inside the sheet rather than the page. */
  maxHeight?: string;
}

/**
 * Bottom sheet on mobile, centered panel on desktop. Built for the pick-slot option
 * grid, where a full-screen modal on a phone is the wrong shape.
 */
export const Sheet: React.FC<SheetProps> = ({
  isOpen, onClose, title, children, maxHeight = '85vh',
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
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-carbon-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxHeight }}
        className="w-full md:max-w-2xl bg-accent-gray border-t md:border border-pure-white/10 rounded-t-2xl md:rounded-xl ring-1 ring-pure-white/10 shadow-2xl flex flex-col animate-fade-in-up md:animate-none pb-safe"
      >
        <div className="shrink-0 pt-3 pb-1 flex justify-center md:hidden">
          <div className="w-10 h-1 rounded-full bg-pure-white/20" aria-hidden="true" />
        </div>
        {title && (
          <div className="shrink-0 px-5 pt-2 pb-3 flex items-center justify-between gap-3 border-b border-pure-white/10">
            <h3 className="text-lg font-bold text-pure-white">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 text-highlight-silver hover:text-pure-white hover:bg-pure-white/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
};
