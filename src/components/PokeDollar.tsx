interface PokeDollarProps {
  className?: string;
  size?: number;
}

/** Inline Poké Dollar currency symbol (stylized ₽-like glyph). */
export function PokeDollar({ className = '', size = 16 }: PokeDollarProps) {
  return (
    <svg
      className={`poke-dollar ${className}`.trim()}
      width={size}
      height={size * 1.37}
      viewBox="0 0 73 100"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M52 0H21C9.4 0 0 9.4 0 21v58c0 11.6 9.4 21 21 21h31c11.6 0 21-9.4 21-21V21C73 9.4 63.6 0 52 0zm-8 12h8c5.5 0 10 4.5 10 10v4H34V12zm-14 0v14H14v-4c0-5.5 4.5-10 10-10h8zm-8 22h47v8H22v-8zm0 16h47v8H22v-8zm8 16h31c5.5 0 10-4.5 10-10v-4H34v14z"
      />
    </svg>
  );
}

export function PokeDollarAmount({ amount, className = '' }: { amount: number; className?: string }) {
  return (
    <span className={`poke-dollar-amount ${className}`.trim()}>
      <span className="poke-dollar-symbol">¥</span>
      <span>{amount}</span>
    </span>
  );
}

export function PokeCenterVisits({ lives }: { lives: number }) {
  const count = Math.max(0, lives);
  return (
    <span className="pokecenter-visits" title={`${lives} ${lives === 1 ? 'life' : 'lives'} remaining`}>
      Lives: <span className="pokecenter-visits__icons">{'❤️'.repeat(count)}</span>
    </span>
  );
}
