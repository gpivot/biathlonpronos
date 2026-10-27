import { CheckIcon } from "@/components/icons";

/** Petite mention « Pronostic validé » affichée sous une course déjà pronostiquée. */
export function PredictedBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1 font-display text-[11px] font-bold text-ice">
      <CheckIcon className="h-3 w-3" />
      {label}
    </div>
  );
}
