import { useId } from "react";

/**
 * Pictos des pronostics de saison : gros globe de cristal (classement général), dossard bleu
 * (meilleur·e jeune, comme le dossard du leader U25) et drapeau (meilleure nation).
 * `category` : valeur de `season_predictions.category` (gros_globe_f, meilleur_jeune_h…).
 */
export function SeasonCategoryIcon({ category, className = "h-6 w-6" }: { category: string; className?: string }) {
  if (category.startsWith("gros_globe")) return <CrystalGlobeIcon className={className} />;
  if (category.startsWith("meilleur_jeune")) return <BlueBibIcon className={className} />;
  if (category.startsWith("meilleure_nation")) return <NationFlagIcon className={className} />;
  return null;
}

/** Le gros globe de cristal remis au vainqueur du général : sphère facettée sur un socle. */
export function CrystalGlobeIcon({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-glass`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor="#CDEBFA" />
          <stop offset="1" stopColor="#6FB7DD" />
        </radialGradient>
        <linearGradient id={`${id}-base`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9F5FC" />
          <stop offset="1" stopColor="#8FC3E0" />
        </linearGradient>
      </defs>
      {/* sphère */}
      <circle cx="16" cy="12.5" r="10" fill={`url(#${id}-glass)`} stroke="#4A9CC8" strokeWidth="1" />
      {/* facettes de cristal */}
      <g fill="none" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="0.7">
        <ellipse cx="16" cy="12.5" rx="10" ry="3.6" />
        <ellipse cx="16" cy="12.5" rx="4.2" ry="10" />
        <path d="M7.2 8.2 L16 12.5 L24.8 8.2 M7.2 16.8 L16 12.5 L24.8 16.8" strokeOpacity="0.5" />
      </g>
      <ellipse cx="12.2" cy="7.6" rx="2.6" ry="1.5" fill="#FFFFFF" fillOpacity="0.9" transform="rotate(-30 12.2 7.6)" />
      {/* col et socle */}
      <path d="M13.6 22.2 h4.8 l-0.8 2.6 h-3.2 z" fill={`url(#${id}-base)`} stroke="#4A9CC8" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M9.5 25 h13 l1.3 4 H8.2 z" fill={`url(#${id}-base)`} stroke="#4A9CC8" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  );
}

/** Dossard bleu du ou de la meilleur·e jeune. */
export function BlueBibIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      {/* dossard : bretelles + plastron */}
      <path
        d="M9 3 h4 c0 2.2 1.3 3.6 3 3.6 s3-1.4 3-3.6 h4 l1.2 6 v19.4 a1.6 1.6 0 0 1-1.6 1.6 H9.4 a1.6 1.6 0 0 1-1.6-1.6 V9 z"
        fill="#1E6FD9"
        stroke="#0F4C9E"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <rect x="10.5" y="12" width="11" height="10" rx="1.4" fill="#FFFFFF" />
      <text
        x="16"
        y="19.6"
        textAnchor="middle"
        fontSize="5.8"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#0F4C9E"
      >
        U25
      </text>
    </svg>
  );
}

/** Drapeau de la meilleure nation. */
export function NationFlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="6" y="3" width="1.8" height="27" rx="0.9" fill="#8A93A0" />
      <circle cx="6.9" cy="3.2" r="1.6" fill="#B7BEC8" />
      <path
        d="M7.8 5.5 c4-1.8 7 1.6 11 0 s5.5-1.2 7.2-0.2 v12.2 c-1.7-1-3.2-1.6-7.2 0.2 s-7-1.8-11 0 z"
        fill="#E3B341"
        stroke="#B8862B"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M14.6 7.4 l1.05 2.15 2.35 0.35 -1.7 1.65 0.4 2.35 -2.1-1.1 -2.1 1.1 0.4-2.35 -1.7-1.65 2.35-0.35 z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
