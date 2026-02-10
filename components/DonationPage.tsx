
import React from 'react';
import { User } from '../types.ts';
import { Page } from '../App.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { DonationIcon } from './icons/DonationIcon.tsx';
import { BackIcon } from './icons/BackIcon.tsx';
import { DONATION_VENMO_URL } from '../constants.ts';

interface DonationPageProps {
  user: User | null;
  setActivePage: (page: Page) => void;
}

const DonationPage: React.FC<DonationPageProps> = ({ user, setActivePage }) => {
    const hubAction = (
        <button 
            onClick={() => setActivePage('league-hub')}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30"
        >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold">League Hub</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full overflow-hidden w-full">
            <div className="flex-none">
                <PageHeader 
                    title="SUPPORT THE LEAGUE" 
                    icon={DonationIcon} 
                    subtitle="Help keep the league running." 
                    leftAction={hubAction}
                />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 flex flex-col items-center">
                <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-8 items-stretch px-4 md:px-0 pb-8">
                    {/* Victory Junction Tile */}
                    <div className="bg-carbon-fiber p-6 rounded-xl border border-pure-white/10 shadow-2xl text-center flex flex-col h-full relative overflow-hidden group">
                        <div className="absolute inset-0 bg-primary-red/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        
                        <h2 className="text-xl font-black text-pure-white uppercase italic tracking-wide">Victory Junction</h2>
                        <p className="text-highlight-silver text-sm mt-4 max-w-lg mx-auto flex-grow leading-relaxed">
                            Give kids with complex medical needs the chance to experience camp adventures like zip lining, archery, and fishing in a safe, barrier-free environment where they can grow and thrive.
                        </p>
                        
                        <div className="pt-8 pb-2">
                            <a 
                                href="https://victoryjunction.org/donate-online/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block w-full md:w-auto bg-primary-red hover:bg-red-600 text-pure-white font-bold py-3 px-10 rounded-lg transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(218,41,28,0.3)] uppercase tracking-wider text-sm"
                            >
                                Donate Now
                            </a>
                        </div>
                    </div>

                    {/* Separator */}
                    <div className="flex items-center justify-center py-2 md:py-0">
                        <div className="flex md:flex-col items-center gap-3">
                            <div className="h-px md:h-12 w-12 md:w-px bg-pure-white/10"></div>
                            <span className="text-center text-highlight-silver font-bold text-xs uppercase tracking-widest bg-carbon-black/50 px-2 py-1 rounded border border-pure-white/5">or</span>
                            <div className="h-px md:h-12 w-12 md:w-px bg-pure-white/10"></div>
                        </div>
                    </div>
                    
                    {/* League Operational Costs Tile */}
                    <div className="bg-carbon-fiber p-6 rounded-xl border border-pure-white/10 shadow-2xl text-center flex flex-col h-full relative overflow-hidden group">
                        <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                        <h2 className="text-xl font-black text-pure-white uppercase italic tracking-wide">League Operations</h2>
                        <p className="text-highlight-silver text-sm mt-4 mb-4 flex-grow leading-relaxed">
                            Your contribution helps cover cloud hosting fees, domain costs, and keeps the league platform running smoothly for the season.
                        </p>
                        
                        <div className="pt-4 pb-2">
                             <a 
                                href={DONATION_VENMO_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block w-full md:w-auto bg-[#008CFF] hover:bg-[#0077D9] text-pure-white font-bold py-3 px-10 rounded-lg transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(0,140,255,0.3)] uppercase tracking-wider text-sm"
                            >
                                Donate via Venmo
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DonationPage;