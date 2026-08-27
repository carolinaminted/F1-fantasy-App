import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title, description, icon: Icon, action, className = '',
}) => (
  <div className={`w-full py-12 px-6 flex flex-col items-center text-center ${className}`}>
    {Icon && (
      <div className="w-14 h-14 rounded-full bg-accent-gray/60 border border-pure-white/10 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-highlight-silver" />
      </div>
    )}
    <h3 className="text-lg font-bold text-pure-white">{title}</h3>
    {description && (
      <p className="mt-1.5 text-sm text-highlight-silver max-w-sm leading-relaxed">{description}</p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
