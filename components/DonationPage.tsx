import React from 'react';
import { User } from '../types.ts';
import { Page } from '../App.tsx';

interface DonationPageProps {
  user: User | null;
  setActivePage: (page: Page) => void;
}

const DonationPage: React.FC<DonationPageProps> = ({ user, setActivePage }) => {
    return (
        <div className="max-w-5xl mx-auto space-y-12">
            <div>
                <h1 className="text-3xl font-bold text-center mb-8">Make a Donation</h1>

                <div className="bg-accent-gray/30 backdrop-blur-sm p-6 rounded-lg ring-1 ring-pure-white/10 text-center mb-6">
                    <h2 className="text-xl font-semibold text-pure-white">Donate directly to Victory Junction</h2>
                    <p className="text-highlight-silver text-sm mt-2 max-w-xl mx-auto">
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
                </div>

                <p className="text-center text-highlight-silver mb-8">... or ...</p>
                
                <main className="bg-accent-gray/50 backdrop-blur-sm p-6 md:p-8 rounded-lg ring-1 ring-pure-white/10 text-center">
                    <h2 className="text-xl font-semibold text-pure-white">Contribute to League Operational Costs</h2>
                    <p className="text-highlight-silver text-sm mt-2 mb-4">Your contribution helps cover hosting fees and keeps the league running smoothly for the season. Thank you for your support!</p>
                     <a 
                        href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=jhouser1988@gmail.com&item_name=F1+Fantasy+League+Operational+Costs&currency_code=USD"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block bg-blue-600 hover:bg-blue-500 text-pure-white font-bold py-3 px-8 rounded-lg transition-transform transform hover:scale-105"
                    >
                        Donate via PayPal
                    </a>
                    <p className="text-xs text-highlight-silver/50 mt-4">
                        Note: You will be redirected to PayPal's secure website
                    </p>
                </main>
            </div>
        </div>
    );
};

export default DonationPage;