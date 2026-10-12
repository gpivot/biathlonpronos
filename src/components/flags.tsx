// Drapeaux et noms des langues proposées, partagés par le sélecteur de langue et la page Profil.
// Drapeaux en SVG (et non en emoji) : Windows n'affiche pas les emojis drapeaux.
export function FlagFR({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 3 2" className={className} preserveAspectRatio="xMidYMid slice">
      <rect width="1" height="2" fill="#0055A4" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#EF4135" />
    </svg>
  );
}

function FlagGB({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} preserveAspectRatio="xMidYMid slice">
      <clipPath id="gb-clip">
        <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
      </clipPath>
      <path d="M0 0v30h60V0z" fill="#012169" />
      <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0l60 30m0-30L0 30" clipPath="url(#gb-clip)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

// Drapeaux tricolores (bandes verticales ou horizontales).
function Tricolor({ colors, horizontal, className }: { colors: [string, string, string]; horizontal?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 3 2" className={className} preserveAspectRatio="none">
      {colors.map((color, i) =>
        horizontal ? (
          <rect key={i} y={(i * 2) / 3} width="3" height={2 / 3} fill={color} />
        ) : (
          <rect key={i} x={i} width="1" height="2" fill={color} />
        ),
      )}
    </svg>
  );
}

function FlagDE({ className }: { className?: string }) {
  return <Tricolor horizontal colors={["#000", "#DD0000", "#FFCE00"]} className={className} />;
}

function FlagIT({ className }: { className?: string }) {
  return <Tricolor colors={["#009246", "#fff", "#CE2B37"]} className={className} />;
}

function FlagES({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 3 2" className={className} preserveAspectRatio="none">
      <rect width="3" height="2" fill="#AA151B" />
      <rect y="0.5" width="3" height="1" fill="#F1BF00" />
    </svg>
  );
}

export const FLAGS: Record<string, { Flag: (props: { className?: string }) => JSX.Element; label: string }> = {
  fr: { Flag: FlagFR, label: "Français" },
  en: { Flag: FlagGB, label: "English" },
  de: { Flag: FlagDE, label: "Deutsch" },
  it: { Flag: FlagIT, label: "Italiano" },
  es: { Flag: FlagES, label: "Español" },
};
