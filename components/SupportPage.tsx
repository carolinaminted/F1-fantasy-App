import React from 'react';
import { User } from '../types.ts';
import { Page } from '../App.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { BackIcon } from './icons/BackIcon.tsx';

interface SupportPageProps {
  user: User | null;
  setActivePage: (page: Page) => void;
}

const SupportPage: React.FC<SupportPageProps> = ({ user, setActivePage }) => {
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
                    title="SUPPORT & FEEDBACK" 
                    icon={() => (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.82 1.508-2.316a7.5 7.5 0 1 0-7.516 0c.85.496 1.508 1.333 1.508 2.316v.192m6 3a46.236 46.236 0 0 1-1.5 0m-3 0a46.236 46.236 0 0 0-1.5 0" />
                        </svg>
                    )}
                    subtitle="Get help or share your thoughts." 
                    leftAction={hubAction}
                />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 flex flex-col items-center">
                <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-8 items-stretch px-4 md:px-0 pb-8">
                    {/* Site Feedback & Feature Requests Tile */}
                    <div className="bg-carbon-fiber p-6 rounded-xl border border-pure-white/10 shadow-2xl text-center flex flex-col h-full relative overflow-hidden group">
                        <div className="absolute inset-0 bg-primary-red/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        
                        <h2 className="text-xl font-black text-pure-white uppercase italic tracking-wide">Site Feedback & Feature Requests</h2>
                        <ul className="text-highlight-silver text-sm mt-4 max-w-lg mx-auto flex-grow leading-relaxed text-center space-y-2">
                            <li>General site feedback</li>
                            <li>Quick questionnaire responses</li>
                            <li>New enhancement or feature requests</li>
                        </ul>
                        
                        <div className="pt-8 pb-2">
                            <a 
                                href="https://forms.gle/zVmBrPATMqtFhRCb7"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block w-full md:w-auto bg-primary-red hover:bg-red-600 text-pure-white font-bold py-3 px-10 rounded-lg transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(218,41,28,0.3)] uppercase tracking-wider text-sm"
                            >
                                Google Form
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
                    
                    {/* Questions & Concerns Tile */}
                    <div className="bg-carbon-fiber p-6 rounded-xl border border-pure-white/10 shadow-2xl text-center flex flex-col h-full relative overflow-hidden group">
                        <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                        <h2 className="text-xl font-black text-pure-white uppercase italic tracking-wide">Questions & Concerns</h2>
                        <ul className="text-highlight-silver text-sm mt-4 mb-4 flex-grow leading-relaxed text-center list-none">
                            <li>For any direct questions, account issues, or concerns</li>
                        </ul>
                        
                        <div className="pt-4 pb-2">
                             <span className="text-lg md:text-xl font-bold text-pure-white tracking-wide select-all">
                                lightsoutleague2026@gmail.com
                             </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupportPage;
