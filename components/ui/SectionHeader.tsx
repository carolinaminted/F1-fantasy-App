import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  action?: React.ReactNode;
  className?: string;
}

/** Section-level heading. PageHeader remains the page-level one. */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title, subtitle, icon: Icon, action, className = '',
}) => (
  <div className={`flex items-end justify-between gap-4 mb-3 ${className}`}>
    <div className="flex items-center gap-2.5 min-w-0">
      {Icon && <Icon className="w-5 h-5 text-primary-red shrink-0" />}
      <div className="min-w-0">
        <h2 className="text-lg md:text-xl font-black uppercase italic tracking-wide text-pure-white truncate">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px] text-highlight-silver uppercase tracking-wider opacity-80 truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
