import React from 'react';

interface PageShellProps {
  children: React.ReactNode;
  /**
   * `locked` reproduces the old `isLockedLayout` behaviour from App.tsx: the page fills the
   * viewport and scrolling happens inside child containers (DataTable) rather than on the page.
   */
  locked?: boolean;
  className?: string;
}

export const PageShell: React.FC<PageShellProps> = ({ children, locked, className = '' }) => (
  <div
    className={[
      'w-full max-w-7xl mx-auto px-4 md:px-6',
      locked ? 'flex flex-col h-full min-h-0 overflow-hidden' : 'pb-24',
      className,
    ].filter(Boolean).join(' ')}
  >
    {children}
  </div>
);
