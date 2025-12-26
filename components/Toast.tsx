import React, { useEffect } from 'react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[2000] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: () => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, 5000); // 5 seconds
    return () => clearTimeout(timer);
  }, [onRemove]);

  const bgColors = {
    success: 'bg-green-900/90 border-green-500 shadow-green-500/20',
    error: 'bg-red-900/90 border-primary-red shadow-primary-red/20',
    info: 'bg-accent-gray/90 border-highlight-silver shadow-pure-white/10',
  };

  const icons = {
    success: (
      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ),
    error: (
      <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ),
    info: (
      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    )
  };

  return (
    <div 
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-lg border-l-4 shadow-xl backdrop-blur-md text-white animate-fade-in-down transition-all transform hover:scale-[1.02] cursor-pointer ${bgColors[toast.type]}`} 
      onClick={onRemove}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex-shrink-0 pt-0.5">
        {icons[toast.type]}
      </div>
      <p className="text-sm font-medium flex-1 pt-0.5 leading-tight">{toast.message}</p>
      <button 
        onClick={(e) => { e.stopPropagation(); onRemove(); }} 
        className="text-white/50 hover:text-white transition-colors"
        aria-label="Close notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
};
