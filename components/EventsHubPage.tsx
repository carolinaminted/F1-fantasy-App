
import React from 'react';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { TrackIcon } from './icons/TrackIcon.tsx';
import { GarageIcon } from './icons/GarageIcon.tsx';
import { Page } from '../App.tsx';

interface EventsHubPageProps {
    setActivePage: (page: Page) => void;
}

const EventsHubPage: React.FC<EventsHubPageProps> = ({ setActivePage }) => {
    return (
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 animate-fade-in">
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-pure-white mb-4">Race Events Hub</h1>
                <p className="text-lg text-highlight-silver max-w-2xl mx-auto">
                    Access the complete 2026 season schedule, official race results, and team grid information all in one place.
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                <HubTile 
                    icon={CalendarIcon}
                    title="Schedule"
                    subtitle="2026 Season Calendar"
                    description="Upcoming race dates, circuit info, and session start times."
                    onClick={() => setActivePage('schedule')}
                    delay="0ms"
                />
                <HubTile 
                    icon={TrackIcon}
                    title="GP Results"
                    subtitle="Race Classifications"
                    description="Official finishing orders, fastest laps, and points awarded."
                    onClick={() => setActivePage('gp-results')}
                    delay="100ms"
                />
                <HubTile 
                    icon={GarageIcon}
                    title="Drivers & Teams"
                    subtitle="The Grid"
                    description="Constructor rosters, driver line-ups, and team details."
                    onClick={() => setActivePage('drivers-teams')}
                    delay="200ms"
                />
            </div>
        </div>
    );
};

const HubTile: React.FC<{ icon: any, title: string, subtitle: string, description: string, onClick: () => void, delay: string }> = ({ icon: Icon, title, subtitle, description, onClick, delay }) => (
    <button
        onClick={onClick}
        className="group relative overflow-hidden bg-carbon-fiber rounded-2xl p-8 text-left border border-pure-white/10 hover:border-primary-red/50 shadow-xl hover:shadow-[0_0_20px_rgba(218,41,28,0.15)] transition-all duration-300 transform hover:-translate-y-2 flex flex-col h-full animate-fade-in-up"
        style={{ animationDelay: delay }}
    >
        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500 pointer-events-none">
            <Icon className="w-32 h-32 text-pure-white" />
        </div>
        
        <div className="mb-6 bg-carbon-black/50 w-16 h-16 rounded-2xl flex items-center justify-center group-hover:bg-primary-red/20 transition-colors shadow-lg border border-pure-white/5">
            <Icon className="w-8 h-8 text-primary-red" />
        </div>
        
        <div className="relative z-10 flex-grow">
            <p className="text-xs font-bold text-highlight-silver uppercase tracking-widest mb-2">{subtitle}</p>
            <h3 className="text-3xl font-bold text-pure-white mb-3 group-hover:text-primary-red transition-colors">{title}</h3>
            <p className="text-highlight-silver/80 leading-relaxed">{description}</p>
        </div>
        
        <div className="mt-8 flex items-center gap-2 text-sm font-bold text-pure-white opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
            View Page <span className="text-primary-red">&rarr;</span>
        </div>
    </button>
);

export default EventsHubPage;
