import React, { useState, useRef, useCallback, useEffect } from 'react';
import { NUMERIC } from './ui/tokens.ts';

/**
 * The start-lights easter egg.
 *
 * Five reds come on in sequence, hold for a random beat, then go out together — and the
 * moment they do, your reaction is being timed. Because that is the thing every F1 fan
 * has actually wondered about themselves.
 *
 * Go early and it is a jump start, with the drive-through you deserve.
 */

export type EggPhase =
  | 'idle'       // not running
  | 'arming'     // lights coming on, one at a time
  | 'hold'       // all five lit, random hold — going now is a jump start
  | 'go'         // lights out, clock running
  | 'result'     // reaction measured
  | 'jumpstart'; // moved before lights out

/** Real F1 reference points, in milliseconds. */
const RECORD_MS = 140;      // fastest reaction ever recorded off the line
const GRID_AVERAGE_MS = 250;

interface Verdict { title: string; blurb: string; tone: string; confetti: boolean }

const verdictFor = (ms: number): Verdict => {
  if (ms < 120) return {
    title: 'Anticipated',
    blurb: `Quicker than any reaction ever recorded in F1. The stewards are reviewing the footage.`,
    tone: 'text-amber-400', confetti: false,
  };
  if (ms <= 175) return {
    title: 'Lights-out perfect',
    blurb: `Inside the ${RECORD_MS}ms record. That is a front-row launch.`,
    tone: 'text-yellow-400', confetti: true,
  };
  if (ms <= 220) return {
    title: 'Podium reflexes',
    blurb: 'Sharp enough to gain a place into turn one.',
    tone: 'text-green-400', confetti: true,
  };
  if (ms <= 300) return {
    title: 'Points finish',
    blurb: `Right around the ${GRID_AVERAGE_MS}ms grid average. You held your position.`,
    tone: 'text-blue-400', confetti: false,
  };
  if (ms <= 450) return {
    title: 'Bogged down',
    blurb: 'Wheelspin off the line. Two cars went by before you moved.',
    tone: 'text-highlight-silver', confetti: false,
  };
  return {
    title: 'Still in the garage',
    blurb: 'The pack is through turn three. Engine cover is off.',
    tone: 'text-primary-red', confetti: false,
  };
};

const BEST_KEY = 'apex_reaction_best_ms';

const readBest = (): number | null => {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
};

const writeBest = (ms: number) => {
  try { localStorage.setItem(BEST_KEY, String(ms)); } catch { /* private mode, no matter */ }
};

export const useRaceStartEasterEgg = () => {
  const [phase, setPhase] = useState<EggPhase>('idle');
  const [activeLights, setActiveLights] = useState(0);
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lightsOutAtRef = useRef<number>(0);
  const phaseRef = useRef<EggPhase>('idle');

  phaseRef.current = phase;

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  };

  const start = useCallback(() => {
    clearTimers();
    setReactionMs(null);
    setIsNewBest(false);
    setBest(readBest());
    setActiveLights(0);
    setPhase('arming');

    // Five reds, one per second — the real cadence.
    for (let i = 1; i <= 5; i++) later(() => setActiveLights(i), i * 1000);

    // All five lit, then a genuinely unpredictable hold before they go out.
    later(() => {
      setPhase('hold');
      const hold = 700 + Math.random() * 2600;
      later(() => {
        lightsOutAtRef.current = performance.now();
        setActiveLights(0);
        setPhase('go');
        // Nobody is *that* slow — bail out rather than time forever.
        later(() => {
          if (phaseRef.current === 'go') { setReactionMs(9999); setPhase('result'); }
        }, 4000);
      }, hold);
    }, 5000);
  }, []);

  /** Called when the user reacts — pointer or key, anywhere on screen. */
  const react = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'arming' || p === 'hold') {
      clearTimers();
      setPhase('jumpstart');
      return;
    }
    if (p !== 'go') return;

    clearTimers();
    const ms = Math.round(performance.now() - lightsOutAtRef.current);
    setReactionMs(ms);

    const previous = readBest();
    if (ms >= 120 && (previous === null || ms < previous)) {
      writeBest(ms);
      setBest(ms);
      setIsNewBest(previous !== null);
    } else {
      setBest(previous);
    }

    setPhase('result');

    if (verdictFor(ms).confetti) {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({ particleCount: 140, spread: 100, origin: { y: 0.6 },
                   colors: ['#DA291C', '#FFFFFF', '#C0C0C0'], zIndex: 10000 });
        setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, zIndex: 10000 }), 250);
        setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, zIndex: 10000 }), 250);
      }).catch(() => { /* confetti is a nicety, not a requirement */ });
    }
  }, []);

  const close = useCallback(() => {
    clearTimers();
    setPhase('idle');
    setActiveLights(0);
  }, []);

  useEffect(() => () => clearTimers(), []);

  /** Five taps on the lights within two seconds arms the sequence. */
  const handleTriggerClick = useCallback(() => {
    clickCountRef.current += 1;
    if (clickCountRef.current === 1) {
      clickTimerRef.current = setTimeout(() => { clickCountRef.current = 0; }, 2000);
    }
    if (clickCountRef.current >= 5) {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickCountRef.current = 0;
      start();
      return true;
    }
    return false;
  }, [start]);

  return {
    easterEggState: phase, activeLights, handleTriggerClick,
    reactionMs, best, isNewBest, react, restart: start, close,
  };
};

type OverlayProps = ReturnType<typeof useRaceStartEasterEgg>;

/** Where a time sits between the record and a sluggish getaway. */
const ReactionScale: React.FC<{ ms: number }> = ({ ms }) => {
  const FLOOR = 100, CEIL = 600;
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - FLOOR) / (CEIL - FLOOR)) * 100));
  return (
    <div className="w-full mt-6">
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-yellow-400 via-green-500 to-primary-red/70">
        <div className="absolute -top-1 h-3.5 w-0.5 bg-pure-white/50" style={{ left: `${pos(RECORD_MS)}%` }} />
        <div className="absolute -top-1 h-3.5 w-0.5 bg-pure-white/50" style={{ left: `${pos(GRID_AVERAGE_MS)}%` }} />
        <div
          className="absolute -top-2.5 -ml-1.5 w-3 h-6 rounded-sm bg-pure-white shadow-[0_0_12px_rgba(255,255,255,0.9)]"
          style={{ left: `${pos(ms)}%` }}
        />
      </div>
      <div className="relative h-4 mt-1.5 text-[9px] uppercase tracking-wider text-highlight-silver/70">
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pos(RECORD_MS)}%` }}>Record</span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pos(GRID_AVERAGE_MS)}%` }}>Grid avg</span>
      </div>
    </div>
  );
};

export const EasterEggOverlay: React.FC<OverlayProps> = ({
  easterEggState: phase, activeLights, reactionMs, best, isNewBest, react, restart, close,
}) => {
  // The whole screen is the button once the sequence is armed.
  useEffect(() => {
    if (phase === 'idle' || phase === 'result' || phase === 'jumpstart') return;
    const onKey = (e: KeyboardEvent) => { e.preventDefault(); react(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, react]);

  if (phase === 'idle') return null;

  const armed = phase === 'arming' || phase === 'hold' || phase === 'go';
  const verdict = reactionMs !== null ? verdictFor(reactionMs) : null;
  const timedOut = reactionMs === 9999;

  return (
    <div
      onPointerDown={armed ? react : undefined}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden select-none transition-colors duration-100 ${
        phase === 'go' ? 'bg-[#04170a]' : 'bg-carbon-black/98'
      } ${armed ? 'cursor-pointer' : ''}`}
    >
      <div className="absolute inset-0 bg-carbon-fiber opacity-[0.06] pointer-events-none" />

      {/* Speed lines, only while the clock is live. */}
      {phase === 'go' && (
        <div className="absolute inset-0 pointer-events-none opacity-30">
          {[...Array(7)].map((_, i) => (
            <div key={i}
              className="absolute h-px bg-gradient-to-r from-transparent via-green-400/70 to-transparent animate-flare-sweep"
              style={{ top: `${12 + i * 12}%`, left: 0, right: 0, animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      )}

      {/* ---- The gantry: five pairs, as on a real grid --------------------------- */}
      <div className="relative mb-10">
        <div className="flex gap-3 md:gap-5 rounded-2xl border-4 border-[#0d0d0d] bg-[#151515] p-4 md:p-6 shadow-[0_0_60px_rgba(0,0,0,0.9)]">
          {[1, 2, 3, 4, 5].map(col => (
            <div key={col} className="flex flex-col gap-2 md:gap-3">
              {[0, 1].map(row => (
                <div key={row}
                  className={`w-9 h-9 md:w-16 md:h-16 rounded-full border-2 transition-all duration-75 ${
                    activeLights >= col
                      ? 'bg-[#ff1801] border-red-950 shadow-[0_0_35px_#ff1801,inset_0_-4px_8px_rgba(0,0,0,0.45)]'
                      : 'bg-[#0b0b0b] border-[#050505] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)]'
                  }`} />
              ))}
            </div>
          ))}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-8 bg-[#151515]" />
      </div>

      {/* ---- Message ------------------------------------------------------------ */}
      <div className="relative text-center px-6 max-w-lg">
        {phase === 'arming' && (
          <p className="text-sm uppercase tracking-[0.3em] text-highlight-silver animate-pulse">Formation lap complete</p>
        )}

        {phase === 'hold' && (
          <p className="text-sm uppercase tracking-[0.3em] text-primary-red animate-pulse">Wait for it…</p>
        )}

        {phase === 'go' && (
          <h2 className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter text-green-400 drop-shadow-[0_0_30px_rgba(74,222,128,0.6)]">
            GO GO GO
          </h2>
        )}

        {phase === 'jumpstart' && (
          <>
            <h2 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter text-primary-red">
              Jump start
            </h2>
            <p className="text-highlight-silver mt-3">
              You moved before the lights went out. That is a five-second penalty and a very
              awkward radio message.
            </p>
          </>
        )}

        {phase === 'result' && verdict && (
          <>
            {timedOut ? (
              <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-primary-red">
                Did not start
              </h2>
            ) : (
              <>
                <div className={`text-7xl md:text-9xl font-black leading-none ${NUMERIC} ${verdict.tone}`}>
                  {reactionMs}
                  <span className="text-2xl md:text-3xl ml-1 opacity-60">ms</span>
                </div>
                <h3 className={`text-xl md:text-2xl font-black italic uppercase tracking-tight mt-2 ${verdict.tone}`}>
                  {verdict.title}
                </h3>
              </>
            )}
            <p className="text-sm text-highlight-silver mt-3 leading-relaxed">{verdict.blurb}</p>

            {!timedOut && reactionMs !== null && <ReactionScale ms={reactionMs} />}

            {best !== null && (
              <p className={`text-xs mt-4 uppercase tracking-widest ${isNewBest ? 'text-yellow-400 font-bold' : 'text-highlight-silver/70'}`}>
                {isNewBest ? '★ New personal best' : `Personal best · ${best}ms`}
              </p>
            )}
          </>
        )}
      </div>

      {/* ---- Controls ----------------------------------------------------------- */}
      {(phase === 'result' || phase === 'jumpstart') && (
        <div className="relative flex items-center gap-3 mt-8">
          <button onClick={restart}
            className="bg-primary-red hover:opacity-90 text-pure-white font-bold uppercase tracking-wider text-sm py-3 px-7 rounded-xl shadow-lg shadow-primary-red/25 transition-opacity">
            Go again
          </button>
          <button onClick={close}
            className="text-highlight-silver hover:text-pure-white font-bold uppercase tracking-wider text-sm py-3 px-5 transition-colors">
            Back to the pits
          </button>
        </div>
      )}

      {armed && (
        <p className="absolute bottom-10 text-[10px] uppercase tracking-[0.3em] text-highlight-silver/40">
          Tap anywhere the instant they go out
        </p>
      )}
    </div>
  );
};
