
import React from 'react';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { DonationIcon } from './icons/DonationIcon.tsx';
import { DuesIcon } from './icons/DuesIcon.tsx';
import { Page } from '../App.tsx';
import { User } from '../types.ts';

interface LeagueHubPageProps {
    setActivePage: (page: Page) => void;
    user: User | null;
}

const LeagueHubPage: React.FC<LeagueHubPageProps> = ({ setActivePage, user }) => {
    const isPaid = user?.duesPaidStatus === 'Paid';

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 animate-fade-in">
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-pure-white mb-4">League Hub</h1>
                <p className="text-lg text-highlight-silver max-w-2xl mx-auto">
                    Manage your league membership, view scoring rules, and support the community.
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                <HubTile 
                    icon={TrophyIcon}
                    title="Scoring System"
                    subtitle="Rules & Points"
                    description="Understand how points are awarded for race results and driver performance."
                    onClick={() => setActivePage('points')}
                    delay="0ms"
                />
                
                <HubTile 
                    icon={DuesIcon}
                    title={isPaid ? "Membership Active" : "Pay Dues"}
                    subtitle="Membership"
                    description={isPaid ? "Your league dues are paid. You are all set for the season!" : "Settle your entry fees to unlock the full season."}
                    onClick={() => {
                        if (!isPaid) setActivePage('duesPayment');
                    }}
                    delay="100ms"
                    highlight={!isPaid && !!user}
                    completed={isPaid}
                />

                <HubTile 
                    icon={DonationIcon}
                    title="Donate"
                    subtitle="Support"
                    description="Contribute to Victory Junction or help cover league operational costs."
                    onClick={() => setActivePage('donate')}
                    delay="200ms"
                />
            </div>
        </div>
    );
};

const HubTile: React.FC<{ 
    icon: any, 
    title: string, 
    subtitle: string, 
    description: string, 
    onClick: () => void, 
    delay: string, 
    highlight?: boolean,
    completed?: boolean 
}> = ({ icon: Icon, title, subtitle, description, onClick, delay, highlight, completed }) => (
    <button
        onClick={onClick}
        disabled={completed}
        className={`group relative overflow-hidden rounded-2xl p-8 text-left border transition-all duration-300 transform flex flex-col h-full animate-fade-in-up bg-carbon-fiber 
        ${completed 
            ? 'border-green-500/50 cursor-default shadow-[0_0_15px_rgba(34,197,94,0.1)]' 
            : (highlight 
                ? 'border-primary-red shadow-[0_0_20px_rgba(218,41,28,0.2)] hover:-translate-y-2 hover:shadow-primary-red/40' 
                : 'border-pure-white/10 hover:border-primary-red/50 hover:-translate-y-2 hover:shadow-2xl'
              )
        }`}
        style={{ animationDelay: delay }}
    >
        <div className={`absolute top-0 right-0 p-6 opacity-5 transition-opacity transform pointer-events-none ${completed ? 'text-green-500' : (highlight ? 'text-primary-red group-hover:scale-110 group-hover:opacity-10' : 'text-pure-white group-hover:scale-110 group-hover:opacity-10')}`}>
            <Icon className="w-32 h-32" />
        </div>
        
        <div className={`mb-6 w-16 h-16 rounded-2xl flex items-center justify-center transition-colors shadow-lg border 
            ${completed 
                ? 'bg-green-600/20 text-green-500 border-green-500/30' 
                : (highlight 
                    ? 'bg-primary-red/20 text-pure-white border-primary-red/50' 
                    : 'bg-carbon-black/50 text-primary-red border-pure-white/5 group-hover:bg-primary-red/20'
                  )
            }`}>
            <Icon className="w-8 h-8" />
        </div>
        
        <div className="relative z-10 flex-grow">
            <p className="text-xs font-bold text-highlight-silver uppercase tracking-widest mb-2">{subtitle}</p>
            <h3 className={`text-3xl font-bold mb-3 transition-colors ${completed ? 'text-green-400' : 'text-pure-white group-hover:text-primary-red'}`}>{title}</h3>
            <p className="text-highlight-silver/80 leading-relaxed">{description}</p>
        </div>
        
        {!completed && (
            <div className="mt-8 flex items-center gap-2 text-sm font-bold text-pure-white opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                Open <span className="text-primary-red">&rarr;</span>
            </div>
        )}
        {completed && (
             <div className="mt-8 flex items-center gap-2 text-sm font-bold text-green-500">
                <span>&#10003; Paid</span>
            </div>
        )}
    </button>
);

export default LeagueHubPage;
