import React from 'react';
import { BRAND } from '../../brand.ts';
import { F1CarIcon } from '../icons/F1CarIcon.tsx';

interface BrandMarkProps {
  /** `mark` is the glyph alone; `lockup` pairs it with the name. */
  variant?: 'mark' | 'lockup';
  /** Stacks the wordmark across two lines, as the hero and red-flag screens do. */
  stacked?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  onClick?: () => void;
}

const MARK_SIZE = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-16 h-16', hero: 'w-32 h-32' } as const;
const TEXT_SIZE = {
  sm: 'text-sm', md: 'text-xl', lg: 'text-3xl',
  hero: 'text-4xl md:text-6xl',
} as const;

/**
 * The league's logo. Currently draws the F1 car glyph; swapping in a real logo is a
 * change to this one component rather than to the nine places the glyph was used inline.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  variant = 'lockup', stacked, size = 'md', className = '', onClick,
}) => {
  const mark = <F1CarIcon className={`${MARK_SIZE[size]} text-primary-red shrink-0`} aria-hidden="true" />;

  if (variant === 'mark') {
    return (
      <span onClick={onClick} className={className} aria-label={BRAND.name}>
        {mark}
      </span>
    );
  }

  return (
    <span
      onClick={onClick}
      className={`flex items-center gap-2 ${className}`}
      aria-label={BRAND.name}
    >
      {mark}
      <span className={`font-bold ${TEXT_SIZE[size]} leading-none`}>
        {stacked
          ? BRAND.wordmark.map((line, i) => (
              <React.Fragment key={line}>{i > 0 && <br />}{line}</React.Fragment>
            ))
          : BRAND.shortName}
      </span>
    </span>
  );
};
