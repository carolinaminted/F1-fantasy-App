import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  size?: 'sm' | 'md' | 'lg';
  /** Urgent dialogs (session expiry, destructive confirms) get the red ring and glow. */
  urgent?: boolean;
}

const SIZE = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' } as const;

export const Modal: React.FC<ModalProps> = ({
  isOpen, onClose, title, children, footer, icon: Icon, size = 'md', urgent,
}) => {
  useEffect(() => {
    if (!isOpen || !onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={[
          // Cap the panel and scroll the body inside it, so long content (a season of
          // per-race breakdowns) never pushes the header or footer off screen.
          'w-full max-h-[85vh] flex flex-col bg-accent-gray rounded-xl ring-1 ring-pure-white/10 border',
          SIZE[size],
          urgent
            ? 'border-primary-red/50 shadow-[0_0_50px_rgba(218,41,28,0.2)]'
            : 'border-pure-white/10 shadow-2xl',
        ].join(' ')}
      >
        {title && (
          <div className="shrink-0 flex items-center gap-3 px-6 pt-6">
            {Icon && (
              <div className="w-10 h-10 rounded-full bg-primary-red/20 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary-red" />
              </div>
            )}
            <h3 className="text-xl font-bold text-pure-white">{title}</h3>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6">{children}</div>
        {footer && (
          <div className="shrink-0 px-6 pb-6 pt-0 flex items-center justify-end gap-3">{footer}</div>
        )}
      </div>
    </div>
  );
};
