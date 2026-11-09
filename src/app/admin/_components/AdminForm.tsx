"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AdminFormResult } from "@/lib/admin/formAction";
import { useAdminFeedback } from "./AdminFeedback";

/** Nombre d'enregistrements réussis du formulaire, pour que son bouton affiche « Enregistré ✓ ». */
const SavedCountContext = createContext(0);

type FormProps = Omit<React.FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (formData: FormData) => Promise<AdminFormResult>;
  /** Message du bandeau après un enregistrement réussi. */
  successMessage?: string;
  /** Vide les champs après un succès (formulaires de création). */
  resetOnSuccess?: boolean;
};

/**
 * Formulaire de l'admin avec retour visible : le bouton (`SubmitButton`) passe à
 * « Enregistrement… » pendant l'envoi, puis un bandeau confirme (« Enregistré ✓ ») ou donne
 * la raison de l'échec. L'action doit être enveloppée par `adminFormAction` côté serveur.
 */
export function AdminForm({ action, successMessage = "Enregistré ✓", resetOnSuccess, children, ...rest }: FormProps) {
  const notify = useAdminFeedback();
  const formRef = useRef<HTMLFormElement>(null);
  const [savedCount, setSavedCount] = useState(0);

  async function submit(formData: FormData) {
    let result: AdminFormResult;
    try {
      result = await action(formData);
    } catch {
      notify("error", "Échec de l'enregistrement : connexion perdue ou erreur du serveur. Réessaie.");
      return;
    }
    if (result?.error) {
      notify("error", `Non enregistré : ${result.error}`);
      return;
    }
    if (resetOnSuccess) formRef.current?.reset();
    setSavedCount((n) => n + 1);
    notify("success", successMessage);
  }

  return (
    <SavedCountContext.Provider value={savedCount}>
      <form ref={formRef} action={submit} {...rest}>
        {children}
      </form>
    </SavedCountContext.Provider>
  );
}

/**
 * Bouton d'envoi d'un `AdminForm` : grisé avec « Enregistrement… » pendant l'envoi, puis
 * « Enregistré ✓ » quelques secondes après un succès.
 */
export function SubmitButton({
  children,
  className,
  pendingLabel = "Enregistrement…",
  savedLabel = "Enregistré ✓",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  savedLabel?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  const savedCount = useContext(SavedCountContext);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (savedCount === 0) return;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [savedCount]);

  return (
    <button
      type="submit"
      title={title}
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ""} whitespace-nowrap disabled:cursor-wait disabled:opacity-60`}
    >
      {pending ? pendingLabel : showSaved ? savedLabel : children}
    </button>
  );
}
