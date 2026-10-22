"use client";

/**
 * Bouton d'envoi de formulaire qui demande confirmation (suppression, réinitialisation…). Avec
 * `requireText`, il faut retaper ce texte (ex. le nom d'une saison) pour confirmer.
 */
export function ConfirmButton({
  message,
  requireText,
  className,
  title,
  children,
}: {
  message: string;
  requireText?: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      title={title}
      aria-label={title}
      className={className}
      onClick={(e) => {
        e.stopPropagation(); // dans un <summary>, ne pas replier/déplier l'accordéon
        const confirmed = requireText
          ? window.prompt(`${message}\n\nTape « ${requireText} » pour confirmer.`)?.trim() === requireText
          : window.confirm(message);
        if (!confirmed) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
