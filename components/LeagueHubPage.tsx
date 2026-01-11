import React from 'react';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { DonationIcon } from './icons/DonationIcon.tsx';
import { DuesIcon } from './icons/DuesIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { TrackIcon } from './icons/TrackIcon.tsx';
import { GarageIcon } from './icons/GarageIcon.tsx';
import { LeagueIcon } from './icons/LeagueIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { Page } from '../App.tsx';
import { User } from '../types.ts';

interface LeagueHubPageProps {
    setActivePage: (page: Page) => void;
    user: User | null;
}

const LeagueHubPage: React.FC<LeagueHubPageProps> = ({ setActivePage, user }) => {
    const isPaid = user?.duesPaidStatus === 'Paid';

    return (
        <div className="w-full max-w-5xl mx-auto px-2 md:px-0">
            <PageHeader 
                title="LEAGUE HEADQUARTERS" 
                icon={LeagueIcon} 
            />
            
            <div className="pb-20 md:pb-12 px-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* --- Race Information Section --- */}
                    <HubTile 
                        icon={CalendarIcon}
                        title="Schedule"
                        subtitle="Calendar"
                        description="Upcoming race dates and start times."
                        onClick={() => setActivePage('schedule')}
                        delay="0ms"
                    />
                    <HubTile 
                        icon={TrackIcon}
                        title="GP Results"
                        subtitle="Classifications"
                        description="Official finishing orders & points."
                        onClick={() => setActivePage('gp-results')}
                        delay="100ms"
                    />
                    <HubTile 
                        icon={TrophyIcon}
                        title="Scoring System"
                        subtitle="Rules"
                        description="Points breakdown for race results."
                        onClick={() => setActivePage('points')}
                        delay="200ms"
                    />
                    <HubTile 
                        icon={GarageIcon}
                        title="Drivers & Teams"
                        subtitle="The Grid"
                        description="Constructor rosters & driver line-ups."
                        onClick={() => setActivePage('drivers-teams')}
                        delay="300ms"
                    />

                    {/* --- League Administration Section --- */}
                    <HubTile 
                        icon={DonationIcon}
                        title="Donate"
                        subtitle="Support"
                        description="Victory Junction & League Ops."
                        onClick={() => setActivePage('donate')}
                        delay="400ms"
                    />
                    
                    <HubTile 
                        icon={DuesIcon}
                        title={isPaid ? "Membership Active" : "Pay Dues"}
                        subtitle="Status"
                        description={isPaid ? "You are all set for the season!" : "Settle your entry fees to unlock."}
                        onClick={() => {
                            if (!isPaid) setActivePage('duesPayment');
                        }}
                        delay="500ms"
                        highlight={!isPaid && !!user}
                        completed={isPaid}
                    />
                </div>
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
        className={`group relative overflow-hidden rounded-xl p-6 text-left border transition-all duration-300 transform flex flex-col w-full animate-fade-in-up bg-carbon-fiber shadow-lg hover:shadow-2xl hover:-translate-y-1 min-h-[220px]
        ${completed 
            ? 'border-green-500/50 cursor-default shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:translate-y-0 hover:shadow-none' 
            : (highlight 
                ? 'border-primary-red shadow-[0_0_20px_rgba(218,41,28,0.2)] hover:shadow-primary-red/40' 
                : 'border-pure-white/10 hover:border-primary-red/50'
              )
        }`}
        style={{ animationDelay: delay }}
    >
        {/* Background Icon (Huge & Faded) */}
        <div className={`absolute -bottom-6 -right-6 p-0 opacity-[0.03] transition-all transform duration-500 pointer-events-none group-hover:scale-110 group-hover:rotate-12 group-hover:opacity-10 ${completed ? 'text-green-500' : (highlight ? 'text-primary-red' : 'text-pure-white')}`}>
            <Icon className="w-48 h-48" />
        </div>
        
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4 relative z-10">
             <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors shadow-lg border 
                ${completed 
                    ? 'bg-green-600/20 text-green-500 border-green-500/30' 
                    : (highlight 
                        ? 'bg-primary-red/20 text-pure-white border-primary-red/50' 
                        : 'bg-carbon-black/50 text-primary-red border-pure-white/5 group-hover:bg-primary-red/20'
                      )
                }`}>
                <Icon className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-bold text-highlight-silver uppercase tracking-wider bg-carbon-black/30 px-2 py-1 rounded border border-pure-white/5">{subtitle}</p>
        </div>
        
        {/* Content Section */}
        <div className="relative z-10 flex-grow flex flex-col justify-center">
            <h3 className={`text-2xl font-bold mb-2 transition-colors leading-none ${completed ? 'text-green-400' : 'text-pure-white group-hover:text-primary-red'}`}>{title}</h3>
            <p className="text-highlight-silver/70 text-sm leading-snug">{description}</p>
        </div>
        
        {/* Footer Action */}
        {!completed && (
            <div className="mt-4 pt-4 border-t border-pure-white/5 flex items-center justify-between text-xs font-bold text-pure-white opacity-60 group-hover:opacity-100 transition-opacity relative z-10">
                <span>Access Details</span>
                <span className="text-primary-red transform group-hover:translate-x-1 transition-transform">&rarr;</span>
            </div>
        )}
        {completed && (
             <div className="mt-4 pt-4 border-t border-green-500/20 flex items-center gap-2 text-xs font-bold text-green-500 relative z-10">
                <span>&#10003; Membership Confirmed</span>
            </div>
        )}
    </button>
);

export default LeagueHubPage;