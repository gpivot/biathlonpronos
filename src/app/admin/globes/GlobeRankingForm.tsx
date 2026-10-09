"use client";

import { useState } from "react";
import { saveGlobeRanking } from "./actions";

export interface CandidateOption {
  id: string;
  label: string;
}

export function GlobeRankingForm({
  seasonId,
  category,
  title,
  options,
}: {
  seasonId: string;
  category: string;
  title: string;
  options: CandidateOption[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    const result = await saveGlobeRanking(formData);
    setSaving(false);
    setMessage(result.message);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <input type="hidden" name="season_id" value={seasonId} />
      <input type="hidden" name="category" value={category} />
      <div className="text-sm font-semibold">{title}</div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((rank) => (
          <select key={rank} name={`rank_${rank}`} className="rounded border border-border bg-bg px-2 py-1.5 text-sm">
            <option value="">{rank}e — aucun</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {rank}e — {o.label}
              </option>
            ))}
          </select>
        ))}
      </div>
      <button type="submit" disabled={saving} className="self-start rounded bg-ice px-4 py-1.5 text-sm font-bold text-[#062024]">
        {saving ? "Calcul en cours..." : "Enregistrer le classement et calculer les scores"}
      </button>
      {message && <div className="text-xs text-ice">{message}</div>}
    </form>
  );
}
