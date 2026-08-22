import React from 'react';
import { NUMERIC } from '../ui/index.ts';
import {
  CATEGORY_KEYS, CATEGORY_HEX, GOLD_HEX, SHORT_LABEL, categoryOf, type ProcessedUser,
} from './utils.ts';

interface PerformanceRadarProps {
  user: ProcessedUser;
  /** Drawn dashed in gold behind the subject, as the standard to measure against. */
  leader: ProcessedUser | null;
  isYou: boolean;
}

const SIZE = 260;
const C = SIZE / 2;
const R = 92;

/** Up / right / down / left, in the fixed category order. */
const ANGLE: Record<number, [number, number]> = {
  0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0],
};

const polygon = (norms: number[]): string =>
  norms
    .map((n, i) => {
      const [dx, dy] = ANGLE[i];
      const clamped = Math.min(1, Math.max(0.04, n));
      return `${i === 0 ? 'M' : 'L'} ${C + dx * R * clamped} ${C + dy * R * clamped}`;
    })
    .join(' ') + ' Z';

/**
 * The shape of a season across the four categories, overlaid on the leader's.
 *
 * Every value plotted is a real breakdown total. The version this replaces also drew a
 * "Championship Points Progression" line chart whose points were the current total
 * multiplied by 0.72, 0.81, 0.89 and 0.95 and labelled R10–R14 — invented history under
 * real members' names. There is no per-event points history in the data, so that chart
 * is gone rather than reproduced.
 */
export const PerformanceRadar: React.FC<PerformanceRadarProps> = ({ user, leader, isYou }) => {
  const maxes = CATEGORY_KEYS.map(k =>
    Math.max(categoryOf(user, k), categoryOf(leader, k), 1)
  );

  const userNorms = CATEGORY_KEYS.map((k, i) => categoryOf(user, k) / maxes[i]);
  const leaderNorms = CATEGORY_KEYS.map((k, i) => categoryOf(leader, k) / maxes[i]);

  const subjectColor = isYou ? '#FFFFFF' : '#DA291C';

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[260px] h-auto overflow-visible"
        role="img"
        aria-label={`Category shape for ${user.displayName}`}
      >
        {[0.25, 0.5, 0.75, 1].map((ring, i) => (
          <circle
            key={ring} cx={C} cy={C} r={R * ring} fill="none"
            stroke="rgba(255,255,255,0.09)" strokeWidth="1"
            strokeDasharray={i === 3 ? undefined : '2 3'}
          />
        ))}
        <line x1={C} y1={C - R} x2={C} y2={C + R} stroke="rgba(255,255,255,0.14)" />
        <line x1={C - R} y1={C} x2={C + R} y2={C} stroke="rgba(255,255,255,0.14)" />

        {leader && (
          <path
            d={polygon(leaderNorms)} fill={`${GOLD_HEX}14`}
            stroke={GOLD_HEX} strokeWidth="1.5" strokeDasharray="4 3"
          />
        )}

        <path
          d={polygon(userNorms)} fill={`${subjectColor}33`}
          stroke={subjectColor} strokeWidth="2.5" strokeLinejoin="round"
        />

        {CATEGORY_KEYS.map((k, i) => {
          const [dx, dy] = ANGLE[i];
          const n = Math.min(1, Math.max(0.04, userNorms[i]));
          return (
            <circle
              key={k} cx={C + dx * R * n} cy={C + dy * R * n} r="4"
              fill={CATEGORY_HEX[k]} stroke="#0A0A0A" strokeWidth="1.5"
            />
          );
        })}

        {CATEGORY_KEYS.map((k, i) => {
          const [dx, dy] = ANGLE[i];
          return (
            <text
              key={k}
              x={C + dx * (R + 20)}
              y={C + dy * (R + 20) + (dy === 0 ? 4 : dy > 0 ? 10 : -4)}
              fill={CATEGORY_HEX[k]} fontSize="10" fontWeight="700"
              textAnchor={dx === 0 ? 'middle' : dx > 0 ? 'start' : 'end'}
              className="font-mono uppercase"
            >
              {SHORT_LABEL[k]} {categoryOf(user, k)}
            </text>
          );
        })}
      </svg>

      <div className={`mt-3 flex flex-wrap items-center justify-center gap-3 text-[10px] ${NUMERIC}`}>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-1 rounded" style={{ backgroundColor: subjectColor }} />
          <span className="text-pure-white font-bold truncate max-w-[10rem]">
            {user.displayName}
          </span>
        </span>
        {leader && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded" style={{ backgroundColor: GOLD_HEX }} />
            <span className="text-amber-400 font-bold truncate max-w-[10rem]">
              P1 {leader.displayName}
            </span>
          </span>
        )}
      </div>
    </div>
  );
};
