
import React from 'react';

interface PageHeaderProps {
    title: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    subtitle?: string;
    rightAction?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, icon: Icon, subtitle, rightAction }) => {
    return (
        <div className="relative flex flex-col md:flex-row items-center justify-center py-6 md:py-8 mb-6 md:mb-8 w-full max-w-7xl mx-auto px-4 md:px-0 flex-none">
            {/* Center Content */}
            <div className="flex flex-col items-center z-10 text-center pointer-events-none">
                <div className="flex items-center gap-4 mb-2">
                    <div className="p-3 bg-primary-red/10 rounded-full border border-primary-red/20 shadow-[0_0_15px_rgba(218,41,28,0.2)] backdrop-blur-sm">
                        <Icon className="w-8 h-8 text-primary-red" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-wider text-pure-white drop-shadow-md">
                        {title}
                    </h1>
                </div>
                {subtitle && (
                    <p className="text-highlight-silver text-sm font-medium tracking-wide uppercase opacity-80">
                        {subtitle}
                    </p>
                )}
            </div>

            {/* Right Action (Absolute on Desktop, Stacked on Mobile) */}
            {rightAction && (
                <div className="mt-6 md:mt-0 w-full md:w-auto md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2 z-20 pointer-events-auto">
                    {rightAction}
                </div>
            )}
        </div>
    );
};
