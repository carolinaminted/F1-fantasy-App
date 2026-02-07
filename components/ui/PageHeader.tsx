import React from 'react';

interface PageHeaderProps {
    title: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    subtitle?: string;
    rightAction?: React.ReactNode;
    leftAction?: React.ReactNode;
    onIconClick?: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, icon: Icon, subtitle, rightAction, leftAction, onIconClick }) => {
    return (
        <div className="w-full max-w-7xl mx-auto px-4 md:px-0 flex-none mb-4 md:mb-6 pt-4 md:pt-6">
            <div className="flex flex-col md:grid md:grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-0">
                
                {/* Left side column (Desktop only) */}
                <div className="hidden md:flex justify-start items-center">
                    {leftAction}
                </div>

                {/* Center Content Column */}
                <div className="flex flex-col items-center text-center pointer-events-none px-4">
                    <div className="flex items-center gap-3 mb-1">
                        <div 
                            onClick={onIconClick}
                            className={`p-2 bg-primary-red/10 rounded-full border border-primary-red/20 shadow-[0_0_15px_rgba(218,41,28,0.2)] backdrop-blur-sm ${onIconClick ? 'pointer-events-auto cursor-pointer active:scale-95 transition-transform' : ''}`}
                        >
                            <Icon className="w-6 h-6 md:w-7 md:h-7 text-primary-red" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-wider text-pure-white drop-shadow-md whitespace-nowrap">
                            {title}
                        </h1>
                    </div>
                    {subtitle && (
                        <p className="text-highlight-silver text-xs md:text-sm font-medium tracking-wide uppercase opacity-80">
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* Right Action Column (Centered on Mobile, End-aligned on Desktop) */}
                <div className="w-full md:w-auto flex justify-center md:justify-end items-center">
                    {rightAction}
                </div>

            </div>
        </div>
    );
};