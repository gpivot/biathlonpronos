import { CheckIcon } from "@/components/icons";

// Encart affiché sous le bouton de validation : confirmation après un
// enregistrement réussi, ou message d'erreur s'il a échoué.
export function SaveFeedback({ success, error }: { success: string | null; error: string | null }) {
  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-red/50 bg-red/10 px-3.5 py-3 text-sm font-semibold text-red">
        {error}
      </div>
    );
  }
  if (!success) return null;
  return (
    <div role="status" className="flex items-center gap-3 rounded-2xl border border-ice bg-ice-soft px-3.5 py-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ice">
        <CheckIcon className="h-3.5 w-3.5 text-on-ice" />
      </div>
      <span className="text-sm font-semibold">{success}</span>
    </div>
  );
}
