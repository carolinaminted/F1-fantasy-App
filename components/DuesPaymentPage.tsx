
import React, { useState, useMemo } from 'react';
import { User } from '../types.ts';
import { Page } from '../App.tsx';
import { BackIcon } from './icons/BackIcon.tsx';
import { PaymentIcon } from './icons/PaymentIcon.tsx';
import { CopyIcon } from './icons/CopyIcon.tsx';
import { PayPalIcon } from './icons/PayPalIcon.tsx';
import { LEAGUE_DUES_AMOUNT, CURRENT_SEASON, PAYPAL_PAY_DUES_URL } from '../constants.ts';
import { logDuesPaymentInitiation } from '../services/firestoreService.ts';
import { useToast } from '../contexts/ToastContext.tsx';

interface DuesPaymentPageProps {
    user: User;
    setActivePage: (page: Page) => void;
}

const DuesPaymentPage: React.FC<DuesPaymentPageProps> = ({ user, setActivePage }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [copySuccess, setCopySuccess] = useState('');
    const { showToast } = useToast();

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
            await logDuesPaymentInitiation(user, LEAGUE_DUES_AMOUNT, CURRENT_SEASON, memo);
            window.open(PAYPAL_PAY_DUES_URL, '_blank', 'noopener,noreferrer');
        } catch (error) {
            console.error("Payment initiation failed:", error);
            showToast("Could not initiate payment. Please try again.", 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto text-pure-white">
             <div className="mb-8">
                 <button 
                    onClick={() => setActivePage('home')}
                    className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors"
                >
                    <BackIcon className="w-5 h-5" />
                    Back to Home
                </button>
            </div>

            <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 md:p-8 ring-1 ring-pure-white/10">
                <div className="text-center mb-6">
                    <PaymentIcon className="w-16 h-16 text-primary-red mx-auto mb-4"/>
                    <h1 className="text-3xl font-bold">Pay League Dues</h1>
                    <p className="text-highlight-silver mt-1">Settle your dues for the {CURRENT_SEASON} season.</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-ghost-white">Amount</label>
                        <div className="mt-1 block w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-3 px-4 text-pure-white">
                            ${LEAGUE_DUES_AMOUNT.toFixed(2)} USD
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
                         <p className="text-xs text-highlight-silver/70 mt-1">Please include this memo in your PayPal transaction.</p>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-accent-gray/50">
                    <button
                        onClick={handlePay}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-center gap-3 bg-primary-red hover:opacity-90 text-pure-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-primary-red/30 disabled:bg-accent-gray disabled:cursor-wait"
                    >
                        <PayPalIcon className="w-6 h-6" />
                        {isProcessing ? 'Processing...' : 'Pay with PayPal'}
                    </button>
                    <p className="text-xs text-center text-highlight-silver/70 mt-4">
                        You will be redirected to PayPal to complete your payment. This action will be logged.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DuesPaymentPage;