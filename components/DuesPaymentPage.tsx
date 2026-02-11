
import React, { useState, useMemo, useEffect } from 'react';
import { User } from '../types.ts';
import { Page } from '../App.tsx';
import { PaymentIcon } from './icons/PaymentIcon.tsx';
import { CopyIcon } from './icons/CopyIcon.tsx';
import { VenmoIcon } from './icons/VenmoIcon.tsx';
import { DuesIcon } from './icons/DuesIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { LEAGUE_DUES_AMOUNT, CURRENT_SEASON, VENMO_PROFILE_URL } from '../constants.ts';
import { logDuesPaymentInitiation, getLeagueConfig } from '../services/firestoreService.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { BackIcon } from './icons/BackIcon.tsx';

interface DuesPaymentPageProps {
    user: User;
    setActivePage: (page: Page) => void;
}

const DuesPaymentPage: React.FC<DuesPaymentPageProps> = ({ user, setActivePage }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [copySuccess, setCopySuccess] = useState('');
    const [amount, setAmount] = useState<number>(LEAGUE_DUES_AMOUNT); // Default fallback
    const { showToast } = useToast();

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const config = await getLeagueConfig();
                if (config.duesAmount) {
                    setAmount(config.duesAmount);
                }
            } catch (e) {
                console.error("Failed to load league dues config, using default.", e);
            }
        };
        fetchConfig();
    }, []);

    const memo = useMemo(() => {
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        return `Dues Payment • ${date} • ${user.email}`;
    }, [user.email]);

    const handleCopy = () => {
        navigator.clipboard.writeText(memo).then(() => {
            setCopySuccess('✓ Copied');
            setTimeout(() => setCopySuccess(''), 2000);
        }, () => {
            setCopySuccess('Failed');
            setTimeout(() => setCopySuccess(''), 2000);
        });
    };
    
    const handlePay = async () => {
        setIsProcessing(true);
        try {
            await logDuesPaymentInitiation(user, amount, CURRENT_SEASON, memo + ` [VENMO]`);
            
            // Link to Venmo Profile
            window.open(VENMO_PROFILE_URL, '_blank', 'noopener,noreferrer');
        } catch (error) {
            console.error("Payment initiation failed:", error);
            showToast("Could not initiate payment. Please try again.", 'error');
        } finally {
            setIsProcessing(false);
        }
    };

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
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-none">
                 <PageHeader 
                    title="PAY LEAGUE DUES" 
                    icon={DuesIcon}
                    leftAction={hubAction}
                />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                <div className="max-w-2xl mx-auto w-full px-4 md:px-0 pb-8">
                    <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 md:p-8 ring-1 ring-pure-white/10">
                        <div className="text-center mb-6">
                            <PaymentIcon className="w-16 h-16 text-primary-red mx-auto mb-4"/>
                            <h2 className="text-2xl font-bold text-pure-white">Secure Payment</h2>
                            <p className="text-highlight-silver mt-1">Settle your dues for the {CURRENT_SEASON} season.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-bold text-ghost-white">Amount</label>
                                <div className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-3 px-4 text-pure-white font-mono text-lg">
                                    ${amount.toFixed(2)} USD
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-bold text-ghost-white">Memo for Payment</label>
                                <div className="relative mt-1">
                                    <textarea
                                        readOnly
                                        value={memo}
                                        className="w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-3 px-4 text-highlight-silver font-mono text-sm resize-none"
                                        rows={2}
                                    />
                                    <button onClick={handleCopy} className="absolute top-2 right-2 p-2 rounded-md bg-carbon-black/80 hover:bg-carbon-black text-ghost-white" aria-label="Copy memo">
                                        {copySuccess ? <span className="text-xs font-bold">{copySuccess}</span> : <CopyIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                                <p className="text-xs text-highlight-silver/70 mt-1">Please include this memo in your transaction note.</p>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-accent-gray/50 space-y-3">
                            <button
                                onClick={handlePay}
                                disabled={isProcessing}
                                className="w-full flex items-center justify-center gap-3 bg-[#008CFF] hover:opacity-90 text-pure-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-blue-500/30 disabled:bg-accent-gray disabled:cursor-wait"
                            >
                                <VenmoIcon className="w-6 h-6" />
                                {isProcessing ? 'Processing...' : 'Pay with Venmo'}
                            </button>

                            <p className="text-xs text-center text-highlight-silver/70 mt-4">
                                You will be redirected to your selected provider. This action will be logged for admin review.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DuesPaymentPage;