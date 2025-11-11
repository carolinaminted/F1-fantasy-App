import React, { useState, useEffect, useCallback } from 'react';
import { User, Donation } from '../types.ts';
import { Page } from '../App.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { HistoryIcon } from './icons/HistoryIcon.tsx';
import DonationPreviewModal from './DonationPreviewModal.tsx';
import { createDonationRecord, getUserDonations } from '../services/firestoreService.ts';

interface DonationPageProps {
  user: User | null;
  setActivePage: (page: Page) => void;
  onDonationSubmit: (amount: number) => void;
}

const RequiredIndicator: React.FC = () => (
    <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-primary-red animate-pulse-red"></span>
);

const DonationPage: React.FC<DonationPageProps> = ({ user, setActivePage, onDonationSubmit }) => {
    const [amount, setAmount] = useState<number>(50);
    const [customAmount, setCustomAmount] = useState<string>('');
    const [isCustom, setIsCustom] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    // Accordion states
    const [donorInfoOpen, setDonorInfoOpen] = useState(false);
    const [paymentInfoOpen, setPaymentInfoOpen] = useState(false);

    // Form fields state
    const [firstName, setFirstName] = useState(user?.displayName.split(' ')[0] || '');
    const [lastName, setLastName] = useState(user?.displayName.split(' ').slice(1).join(' ') || '');
    const [email, setEmail] = useState(user?.email || '');
    
    const [cardName, setCardName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvc, setCvc] = useState('');
    
    // Donation History State
    const [donations, setDonations] = useState<Donation[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);

    const presetAmounts = [5, 10, 25, 50, 100];
    
    const finalAmount = isCustom ? (parseFloat(customAmount) || 0) : amount;

    // Field-level validation checks
    const isFirstNameValid = firstName.trim() !== '';
    const isLastNameValid = lastName.trim() !== '';
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isCardNameValid = cardName.trim() !== '';
    const isCardNumberValid = cardNumber.replace(/\s/g, '').length === 16;
    const isExpiryValid = /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry);
    const isCvcValid = cvc.length >= 3 && cvc.length <= 4;


    // Section-level validation checks
    const isDonorInfoValid = isFirstNameValid && isLastNameValid && isEmailValid;
    const isPaymentInfoValid = isCardNameValid && isCardNumberValid && isExpiryValid && isCvcValid;
    const isFormValid = isDonorInfoValid && isPaymentInfoValid && finalAmount > 0;

    const fetchDonations = useCallback(async () => {
        if (user) {
            setIsLoadingHistory(true);
            const userDonations = await getUserDonations(user.id);
            setDonations(userDonations);
            setIsLoadingHistory(false);
        }
    }, [user]);
    
    useEffect(() => {
        fetchDonations();
    }, [fetchDonations]);

    useEffect(() => {
        // Auto-open donor info if it's not valid
        if(!isDonorInfoValid) {
            setDonorInfoOpen(true);
        }
    }, [isDonorInfoValid]);

    const handleAmountClick = (value: number) => {
        setAmount(value);
        setIsCustom(false);
        setCustomAmount('');
    };

    const handleCustomClick = () => {
        setAmount(0);
        setIsCustom(true);
    };

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/[^0-9.]/g, '');
        setCustomAmount(value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid || !user) return;
        setIsProcessing(true);
        
        try {
            const donationData = {
                amount: finalAmount * 100,
                currency: 'USD',
                methodType: 'card' as const,
                cardLast4: cardNumber.slice(-4),
                provider: 'stripe',
                providerTxnId: `pi_${Math.random().toString(36).substr(2, 9)}`,
            };

            await createDonationRecord(user.id, donationData);
            await fetchDonations(); // Refresh the list
            onDonationSubmit(finalAmount);

        } catch (error) {
            console.error("Donation processing failed:", error);
            alert("There was an error processing your donation. Please try again.");
            setIsProcessing(false);
        }
    };
    
    const formatCardNumber = (value: string) => {
        return value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
    };
    
    const formatExpiry = (value: string) => {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length > 2) {
            return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
        }
        return cleaned;
    };
    
     const formatDate = (timestamp: { seconds: number }) => {
        return new Date(timestamp.seconds * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };
    
    return (
        <>
        <div className="max-w-5xl mx-auto space-y-12">
            <div>
                <h1 className="text-3xl font-bold text-center mb-8">Make a Donation</h1>

                <div className="bg-accent-gray/30 backdrop-blur-sm p-6 rounded-lg ring-1 ring-pure-white/10 text-center mb-6">
                    <h2 className="text-xl font-semibold text-pure-white">Donate directly to Victory Junction</h2>
                    <a 
                        href="https://victoryjunction.org/donate-online/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 px-6 rounded-lg transition-transform transform hover:scale-105"
                    >
                        Donate Now
                    </a>
                </div>

                <p className="text-center text-highlight-silver mb-8">... or contribute to the league's operational costs below ...</p>
                
                <main className="bg-accent-gray/50 backdrop-blur-sm p-6 md:p-8 rounded-lg ring-1 ring-pure-white/10">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                        {/* Left Column: Amount Selection */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-primary-red text-center">Choose an Amount</h2>
                            <p className="text-highlight-silver text-sm">Your generous contribution helps support the league and cover operational costs for the season.</p>
                            <div className="grid grid-cols-3 gap-3">
                                {presetAmounts.map(preset => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => handleAmountClick(preset)}
                                        className={`p-4 rounded-md text-lg font-bold transition-colors ${
                                            !isCustom && amount === preset
                                                ? 'bg-primary-red text-pure-white'
                                                : 'bg-carbon-black/50 hover:bg-carbon-black/80 text-ghost-white'
                                        }`}
                                    >
                                        ${preset}
                                    </button>
                                ))}
                                <div
                                    className={`rounded-md text-lg font-bold transition-colors relative ${
                                        isCustom ? 'bg-primary-red text-pure-white' : 'bg-carbon-black/50 hover:bg-carbon-black/80 text-ghost-white'
                                    }`}
                                >
                                    <input
                                        type="text"
                                        value={customAmount}
                                        onChange={handleCustomChange}
                                        onFocus={handleCustomClick}
                                        placeholder="Custom"
                                        className="w-full h-full bg-transparent text-center outline-none placeholder-white/80 p-4"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Right Column: Information */}
                        <div className="space-y-4">
                            {/* Donor Information Accordion */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setDonorInfoOpen(!donorInfoOpen)}
                                    className="w-full flex justify-between items-center text-xl font-semibold text-primary-red"
                                >
                                    <span className="w-6 h-6"></span>
                                    <span className="relative pr-3">
                                        Donor Information
                                        {!isDonorInfoValid && <RequiredIndicator />}
                                    </span>
                                    <ChevronDownIcon className={`w-6 h-6 transition-transform ${donorInfoOpen ? 'rotate-180' : ''}`} />
                                </button>
                                <hr className="border-t border-accent-gray my-2" />
                                {donorInfoOpen && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                        <InputField label="First Name" value={firstName} onChange={setFirstName} isInvalid={!isFirstNameValid} />
                                        <InputField label="Last Name" value={lastName} onChange={setLastName} isInvalid={!isLastNameValid} />
                                        <div className="md:col-span-2">
                                            <InputField label="Email Address" value={email} onChange={setEmail} type="email" isInvalid={!isEmailValid} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Payment Information Accordion */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setPaymentInfoOpen(!paymentInfoOpen)}
                                    className="w-full flex justify-between items-center text-xl font-semibold text-primary-red"
                                >
                                    <span className="w-6 h-6"></span>
                                    <span className="relative pr-3">
                                        Payment Information
                                        {!isPaymentInfoValid && <RequiredIndicator />}
                                    </span>
                                    <ChevronDownIcon className={`w-6 h-6 transition-transform ${paymentInfoOpen ? 'rotate-180' : ''}`} />
                                </button>
                                <hr className="border-t border-accent-gray my-2" />
                                {paymentInfoOpen && (
                                    <div className="space-y-4 mt-4">
                                        <InputField label="Name on Card" value={cardName} onChange={setCardName} isInvalid={!isCardNameValid} />
                                        <InputField label="Card Number" value={formatCardNumber(cardNumber)} onChange={setCardNumber} placeholder="0000 0000 0000 0000" maxLength={19} isInvalid={!isCardNumberValid} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <InputField label="Expiry Date" value={formatExpiry(expiry)} onChange={setExpiry} placeholder="MM/YY" maxLength={5} isInvalid={!isExpiryValid} />
                                            <InputField label="CVC" value={cvc.replace(/\D/g, '')} onChange={setCvc} placeholder="123" maxLength={4} isInvalid={!isCvcValid} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Donate Button */}
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={!isFormValid || isProcessing}
                                    className="w-full font-bold text-lg text-pure-white bg-primary-red rounded-lg py-4 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                                >
                                    {isProcessing ? (
                                        <div className="flex justify-center items-center">
                                            <div className="w-2 h-2 bg-pure-white rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                                            <div className="w-2 h-2 bg-pure-white rounded-full animate-bounce mx-1" style={{animationDelay: '0.1s'}}></div>
                                            <div className="w-2 h-2 bg-pure-white rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                        </div>
                                    ) : (
                                        `Donate $${finalAmount.toFixed(2)}`
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </main>
            </div>

            {/* Donation History Section */}
            <div>
                 <h2 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-3">
                    <HistoryIcon className="w-7 h-7" /> Your Donation History
                </h2>
                <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
                    {isLoadingHistory ? (
                        <p className="p-8 text-center text-highlight-silver">Loading history...</p>
                    ) : donations.length === 0 ? (
                        <p className="p-8 text-center text-highlight-silver">No donations exist for this user.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-carbon-black/50">
                                    <tr>
                                        <th className="p-4 text-sm font-semibold uppercase text-highlight-silver">Date</th>
                                        <th className="p-4 text-sm font-semibold uppercase text-highlight-silver text-right">Amount</th>
                                        <th className="p-4 text-sm font-semibold uppercase text-highlight-silver hidden md:table-cell">Method</th>
                                        <th className="p-4 text-sm font-semibold uppercase text-highlight-silver hidden sm:table-cell">Transaction ID</th>
                                        <th className="p-4 text-sm font-semibold uppercase text-highlight-silver text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {donations.map(donation => (
                                        <tr 
                                            key={donation.id} 
                                            className="border-t border-accent-gray/50 hover:bg-accent-gray/70 cursor-pointer"
                                            onClick={() => setSelectedDonation(donation)}
                                        >
                                            <td className="p-4 font-semibold whitespace-nowrap">{formatDate(donation.createdAt)}</td>
                                            <td className="p-4 font-bold text-lg text-right whitespace-nowrap">${(donation.amount / 100).toFixed(2)}</td>
                                            <td className="p-4 text-highlight-silver hidden md:table-cell capitalize">
                                                {donation.methodType} {donation.cardLast4 ? `•••• ${donation.cardLast4}`: ''}
                                            </td>
                                            <td className="p-4 text-highlight-silver font-mono text-xs hidden sm:table-cell truncate max-w-xs">{donation.providerTxnId}</td>
                                            <td className="p-4 text-center">
                                                <span className="px-3 py-1 text-xs font-bold uppercase rounded-full bg-green-600/80 text-pure-white">
                                                    {donation.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
        {selectedDonation && user && (
            <DonationPreviewModal 
                donation={selectedDonation} 
                user={user} 
                onClose={() => setSelectedDonation(null)} 
            />
        )}
        </>
    );
};

interface InputFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    maxLength?: number;
    isInvalid: boolean;
}

const InputField: React.FC<InputFieldProps> = ({ label, value, onChange, type = "text", placeholder, maxLength, isInvalid }) => (
    <div>
        <label className="block text-sm text-highlight-silver mb-1 relative pr-3">
            {label}
            {isInvalid && <RequiredIndicator />}
        </label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            className="w-full bg-carbon-black/50 border border-accent-gray rounded-md shadow-sm py-2 px-3 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red"
        />
    </div>
);

export default DonationPage;