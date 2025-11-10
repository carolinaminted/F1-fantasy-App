import React from 'react';
import { Page } from '../App.tsx';

interface DonationSuccessPageProps {
    amount: number;
    setActivePage: (page: Page) => void;
}

const DonationSuccessPage: React.FC<DonationSuccessPageProps> = ({ amount, setActivePage }) => {
    return (
        <div className="min-h-full flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-accent-gray/50 backdrop-blur-sm p-8 rounded-lg ring-1 ring-pure-white/10 text-center">
                <div className="w-16 h-16 bg-primary-red rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-pure-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-pure-white mb-4">Thank You!</h1>
                <p className="text-highlight-silver mb-6">
                    Your generous donation of <span className="font-bold text-pure-white">${amount.toFixed(2)}</span> has been recorded.
                    A confirmation has been sent to your email.
                </p>
                <div className="space-y-3">
                    <button
                        onClick={() => setActivePage('donate')}
                        className="w-full font-bold text-lg text-pure-white bg-primary-red rounded-lg py-3 transition-colors hover:opacity-90"
                    >
                        View Donation History
                    </button>
                    <button
                        onClick={() => setActivePage('home')}
                        className="w-full font-bold text-lg text-highlight-silver bg-carbon-black/50 rounded-lg py-3 transition-colors hover:bg-carbon-black"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DonationSuccessPage;