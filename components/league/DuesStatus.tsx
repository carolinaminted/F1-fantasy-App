import React, { useEffect, useMemo, useState } from 'react';
import { Sheet, NUMERIC } from '../ui/index.ts';
import { CopyIcon } from '../icons/CopyIcon.tsx';
import { VenmoIcon } from '../icons/VenmoIcon.tsx';
import { LEAGUE_DUES_AMOUNT, CURRENT_SEASON, VENMO_PROFILE_URL } from '../../constants.ts';
import { logDuesPaymentInitiation, getLeagueConfig } from '../../services/firestoreService.ts';
import { useToast } from '../../contexts/ToastContext.tsx';
import type { User } from '../../types.ts';

interface DuesStatusProps {
  user: User | null;
  /** Sheet visibility lives in the URL (`?dues=1`) so /dues can deep-link straight into it. */
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

/**
 * Membership status as a header badge, with the payment flow behind it.
 *
 * This started Gate 11 as a full-width card at the top of the League page, which spent a
 * lot of vertical space telling most members something they already knew — that they had
 * paid. Paid is now a quiet pill in the page header; unpaid is the same pill in red, and
 * it is the button that opens the sheet.
 *
 * The write path is unchanged from the page this replaced: the same
 * `logDuesPaymentInitiation` call runs before the same Venmo profile opens, and the memo
 * is built exactly as the old page built it.
 */
export const DuesStatus: React.FC<DuesStatusProps> = ({ user, isOpen, onOpen, onClose }) => {
  const [amount, setAmount] = useState<number>(LEAGUE_DUES_AMOUNT);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyState, setCopyState] = useState('');
  const { showToast } = useToast();

  const isPaid = user?.duesPaidStatus === 'Paid';

  useEffect(() => {
    // Only the unpaid need the live figure; paid members never open the sheet.
    if (isPaid || !user) return;
    let cancelled = false;
    getLeagueConfig()
      .then(config => {
        if (!cancelled && config.duesAmount) setAmount(config.duesAmount);
      })
      .catch(e => console.error('Failed to load league dues config, using default.', e));
    return () => { cancelled = true; };
  }, [isPaid, user]);

  const memo = useMemo(() => {
    const date = new Date().toISOString().split('T')[0];
    return `Dues Payment • ${date} • ${user?.email ?? ''}`;
  }, [user?.email]);

  const handleCopy = () => {
    navigator.clipboard.writeText(memo).then(
      () => { setCopyState('✓ Copied'); setTimeout(() => setCopyState(''), 2000); },
      () => { setCopyState('Failed');   setTimeout(() => setCopyState(''), 2000); }
    );
  };

  const handlePay = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await logDuesPaymentInitiation(user, amount, CURRENT_SEASON, memo + ` [VENMO]`);
      window.open(VENMO_PROFILE_URL, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Payment initiation failed:', error);
      showToast('Could not initiate payment. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) return null;

  const badgeBase =
    'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider transition-colors';

  return (
    <>
      {isPaid ? (
        <span
          className={`${badgeBase} border-green-500/40 bg-green-500/10 text-green-400`}
          title={`Dues settled for the ${CURRENT_SEASON} season`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" aria-hidden="true" />
          Dues Paid
        </span>
      ) : (
        <button
          onClick={onOpen}
          className={`${badgeBase} border-primary-red/50 bg-primary-red/15 text-primary-red hover:bg-primary-red hover:text-pure-white active:scale-95`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary-red animate-pulse" aria-hidden="true" />
          Dues Due
          <span className={NUMERIC}>${amount.toFixed(2)}</span>
        </button>
      )}

      <Sheet isOpen={isOpen && !isPaid} onClose={onClose} title="Pay League Dues">
        <div className="space-y-5">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
              Amount
            </span>
            <span className={`mt-1 block text-3xl font-black text-pure-white ${NUMERIC}`}>
              ${amount.toFixed(2)}{' '}
              <span className="text-sm font-bold uppercase text-highlight-silver">USD</span>
            </span>
            <span className="mt-1 block text-xs text-highlight-silver">
              Entry fee for the {CURRENT_SEASON} season.
            </span>
          </div>

          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
              Memo for payment
            </span>
            <div className="relative mt-1.5">
              <textarea
                readOnly
                value={memo}
                rows={2}
                className={`w-full resize-none rounded-lg border border-pure-white/10 bg-carbon-black px-3.5 py-3 pr-14 text-sm text-highlight-silver ${NUMERIC}`}
              />
              <button
                onClick={handleCopy}
                aria-label="Copy memo"
                className="absolute right-2 top-2 rounded-md bg-carbon-black/80 p-2 text-ghost-white transition-colors hover:bg-pure-white/10"
              >
                {copyState
                  ? <span className="text-[10px] font-bold whitespace-nowrap">{copyState}</span>
                  : <CopyIcon className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-highlight-silver/70">
              Include this memo in your transaction note so the payment can be matched to you.
            </p>
          </div>

          <button
            onClick={handlePay}
            disabled={isProcessing}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#008CFF] py-3 px-4 font-bold text-pure-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            <VenmoIcon className="w-6 h-6" />
            {isProcessing ? 'Processing…' : 'Pay with Venmo'}
          </button>

          <p className="text-center text-[11px] text-highlight-silver/70">
            Venmo opens in a new tab. This action is logged for admin review.
          </p>
        </div>
      </Sheet>
    </>
  );
};
