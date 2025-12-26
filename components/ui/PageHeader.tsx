import React from 'react';

interface PageHeaderProps {
    title: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    subtitle?: string;
    rightAction?: React.ReactNode;
    leftAction?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, icon: Icon, subtitle, rightAction, leftAction }) => {
    return (
        <div className="relative flex flex-col md:flex-row items-center justify-center py-4 md:py-6 mb-4 md:mb-6 w-full max-w-7xl mx-auto px-4 md:px-0 flex-none">
            
            {/* Left Action (Absolute on Desktop, Hidden on Mobile) */}
            {leftAction && (
                <div className="hidden md:flex md:absolute md:left-0 md:top-1/2 md:-translate-y-1/2 z-20 pointer-events-auto justify-start">
                    {leftAction}
                </div>
            )}

            {/* Center Content */}
            <div className="flex flex-col items-center z-10 text-center pointer-events-none">
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-primary-red/10 rounded-full border border-primary-red/20 shadow-[0_0_15px_rgba(218,41,28,0.2)] backdrop-blur-sm">
                        <Icon className="w-6 h-6 md:w-7 md:h-7 text-primary-red" />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-wider text-pure-white drop-shadow-md">
                        {title}
                    </h1>
                </div>
                {subtitle && (
                    <p className="text-highlight-silver text-xs md:text-sm font-medium tracking-wide uppercase opacity-80">
                        {subtitle}
                    </p>
                )}
            </div>

            {/* Right Action (Absolute on Desktop, Stacked on Mobile) - Centered on Mobile */}
            {rightAction && (
                <div className="mt-4 md:mt-0 w-full md:w-auto md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2 z-20 pointer-events-auto flex justify-center md:justify-end">
                    {rightAction}
                </div>
            )}
        </div>
    );
};