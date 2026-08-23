import React from 'react';
import { TILE_BASE, TILE_INTERACTIVE, CATEGORY_THEME, withAlpha, type Category } from './tokens.ts';

interface TileProps {
  children: React.ReactNode;
  /** Category accent, or a raw hex for team-linked tiles. */
  accent?: Category | string;
  /** Draws the accent as a left edge rather than tinting the whole border. */
  accentEdge?: boolean;
  onClick?: () => void;
  /** Reserved for the primary CTA, the live countdown, and the champion row. Nowhere else. */
  glow?: boolean;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING = { none: '', sm: 'p-3', md: 'p-4 md:p-5', lg: 'p-6 md:p-8' } as const;

export const Tile: React.FC<TileProps> = ({
  children, accent, accentEdge, onClick, glow, className = '', padding = 'md',
}) => {
  const isHex = typeof accent === 'string' && accent.startsWith('#');
  const category = !isHex && accent ? CATEGORY_THEME[accent as Category] : undefined;

  const style: React.CSSProperties = {};
  if (isHex && accent) {
    if (accentEdge) style.borderLeftColor = accent;
    else {
      style.borderColor = withAlpha(accent, 0.5);
      style.backgroundColor = withAlpha(accent, 0.08);
    }
  } else if (category) {
    // Painted inline for the same reason team hexes are: a class here only ties with the base
    // border and loses or wins on Tailwind's emit order.
    style.borderColor = accentEdge
      ? category.css
      : `color-mix(in srgb, ${category.css} 50%, transparent)`;
  }

  return (
    <div
      onClick={onClick}
      style={style}
      className={[
        TILE_BASE,
        PADDING[padding],
        onClick ? TILE_INTERACTIVE : '',
        accentEdge ? 'border-l-4' : '',
        glow ? 'shadow-[0_0_30px_rgba(218,41,28,0.18)]' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
};
