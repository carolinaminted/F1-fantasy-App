
import React from 'react';
import { User } from '../types.ts';
import { Page } from '../App.tsx';
import { PAYPAL_DONATION_URL } from '../constants.ts';
import { PageHeader } from './ui/PageHeader.tsx';
import { DonationIcon } from './icons/DonationIcon.tsx';

interface DonationPageProps {
  user: User | null;
  setActivePage: (page: Page) => void;
}

const DonationPage: React.FC<DonationPageProps> = ({ user, setActivePage }) => {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-none">
                <PageHeader 
                    title="SUPPORT THE LEAGUE" 
                    icon={DonationIcon} 
                    subtitle="Help keep the league running." 
                />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] md:gap-8 items-stretch px-4 md:px-0 pb-8">
                    {/* Victory Junction Tile */}
                    <div className="bg-carbon-fiber p-6 rounded-lg border border-pure-white/10 shadow-lg text-center flex flex-col h-full">
                        <h2 className="text-xl font-semibold text-pure-white">Donate directly to Victory Junction</h2>
                        <p className="text-highlight-silver text-sm mt-2 max-w-xl mx-auto flex-grow">
                            Give kids with complex medical needs the chance to experience camp adventures like zip lining, archery, and fishing in a safe, barrier-free environment where they can grow and thrive.
                        </p>
                        <a 
                            href="https://victoryjunction.org/donate-online/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-block bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 px-6 rounded-lg transition-transform transform hover:scale-105"
                        >
                            Donate Now
                        </a>
                        <p className="text-xs text-highlight-silver/50 mt-4">
                            Note: You will be redirected to Victory Junction Camp donation website
                        </p>
                    </div>

                    {/* Separator */}
                    <div className="flex items-center justify-center my-6 md:my-0">
                        <span className="text-center text-highlight-silver">... or ...</span>
                    </div>
                    
                    {/* League Operational Costs Tile */}
                    <div className="bg-carbon-fiber p-6 md:p-8 rounded-lg border border-pure-white/10 shadow-lg text-center flex flex-col h-full">
                        <h2 className="text-xl font-semibold text-pure-white">Contribute to League Operational Costs</h2>
                        <p className="text-highlight-silver text-sm mt-2 mb-4 flex-grow">Your contribution helps cover hosting fees and keeps the league running smoothly for the season. Thank you for your support!</p>
                         <a 
                            href={PAYPAL_DONATION_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-block bg-blue-600 hover:bg-blue-500 text-pure-white font-bold py-3 px-8 rounded-lg transition-transform transform hover:scale-105"
                        >
                            Donate via PayPal
                        </a>
                        <p className="text-xs text-highlight-silver/50 mt-4">
                            Note: You will be redirected to PayPal's secure website
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DonationPage;
