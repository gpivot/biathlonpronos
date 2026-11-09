import { isNotFoundError } from "next/dist/client/components/not-found";
import { isRedirectError } from "next/dist/client/components/redirect";

/** Ce que renvoie une action de formulaire de l'admin : rien si tout va bien, sinon le message d'erreur. */
export type AdminFormResult = { error: string } | undefined;

/**
 * Enveloppe une Server Action de formulaire de l'admin : une erreur levée (Supabase, règle
 * métier…) est renvoyée comme message au lieu d'être lancée. En production, Next.js masque le
 * texte des erreurs levées ; ainsi le formulaire (`AdminForm`) peut afficher la vraie raison.
 * Les redirections (`redirect()`, `notFound()`) passent telles quelles.
 */
export function adminFormAction(fn: (formData: FormData) => Promise<unknown>) {
  return async (formData: FormData): Promise<AdminFormResult> => {
    try {
      await fn(formData);
      return undefined;
    } catch (err) {
      if (isRedirectError(err) || isNotFoundError(err)) throw err;
      return { error: err instanceof Error && err.message ? err.message : "Erreur inconnue." };
    }
  };
}
