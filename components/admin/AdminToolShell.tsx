import React from 'react';
import { PageHeader } from '../ui/index.ts';
import { BackIcon } from '../icons/BackIcon.tsx';
import type { AdminDestination } from '../../routes.ts';

interface AdminToolShellProps {
  title: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  subtitle?: string;
  setAdminSubPage: (page: AdminDestination) => void;
  /** Tool-specific controls — a labelled Save, a filter, an unsaved-changes chip. */
  actions?: React.ReactNode;
  /** Runs before leaving; return false to stay (used by the unsaved-changes guard). */
  onBeforeLeave?: () => boolean;
  children?: React.ReactNode;
}

/**
 * Standard frame for an admin tool: the page header plus one back link home.
 *
 * Eight pages each carried their own copy of the same "Dashboard" button, two of them
 * subtly different. One copy, one label — "Admin Home", which says where it goes rather
 * than naming a screen the reader has to already know.
 */
export const AdminToolShell: React.FC<AdminToolShellProps> = ({
  title, icon, subtitle, setAdminSubPage, actions, onBeforeLeave, children,
}) => {
  const goHome = () => {
    if (onBeforeLeave && !onBeforeLeave()) return;
    setAdminSubPage('dashboard');
  };

  return (
    <>
      <PageHeader
        title={title}
        icon={icon}
        subtitle={subtitle}
        leftAction={
          <button
            onClick={goHome}
            className="flex items-center gap-2 rounded-lg border border-pure-white/10 bg-carbon-black/50 px-4 py-2 text-highlight-silver transition-colors hover:border-pure-white/30 hover:text-pure-white"
          >
            <BackIcon className="w-4 h-4" />
            <span className="text-sm font-bold">Admin Home</span>
          </button>
        }
        rightAction={actions}
      />
      {children}
    </>
  );
};
