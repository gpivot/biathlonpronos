"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Feedback = { kind: "success" | "error"; text: string; id: number };
type Notify = (kind: Feedback["kind"], text: string) => void;

const FeedbackContext = createContext<Notify>(() => {});

/** Affiche un message (« Enregistré ✓ » ou une erreur) depuis n'importe quel formulaire de l'admin. */
export function useAdminFeedback(): Notify {
  return useContext(FeedbackContext);
}

/**
 * Bandeau de confirmation de l'admin, posé dans le layout : il survit aux redirections après
 * enregistrement (ex. retour au calendrier après modification d'une étape). Succès : disparaît
 * seul après 3 s ; erreur : reste 10 s, ou jusqu'au clic sur la croix.
 */
export function AdminFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const notify = useCallback<Notify>((kind, text) => setFeedback({ kind, text, id: Date.now() }), []);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), feedback.kind === "success" ? 3000 : 10000);
    return () => clearTimeout(timer);
  }, [feedback]);

  return (
    <FeedbackContext.Provider value={notify}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
      >
        {feedback && (
          <div
            key={feedback.id}
            className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
              feedback.kind === "success" ? "bg-ice text-on-ice" : "bg-red text-white"
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Fermer"
              className="-mr-1 flex-shrink-0 opacity-80 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </FeedbackContext.Provider>
  );
}
