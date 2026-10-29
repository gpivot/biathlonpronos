"use client";

import { useState } from "react";
import { clearStartList, loadIbuStartList, type StartListImportState } from "./actions";
import { ConfirmButton } from "../../_components/ConfirmButton";
import type { StartList } from "@/lib/startList";

/** Poursuite / mass start : état de la liste de départ et récupération de la liste officielle IBU. */
export function StartListPanel({ raceId, format, startList }: { raceId: string; format: string; startList: StartList }) {
  const [loading, setLoading] = useState(false);
  const [ibuRaceId, setIbuRaceId] = useState("");
  const [report, setReport] = useState<StartListImportState | null>(null);

  async function handleIbu() {
    setLoading(true);
    setReport(null);
    try {
      setReport(await loadIbuStartList(raceId, ibuRaceId || undefined));
    } catch (err) {
      setReport({ ok: false, message: err instanceof Error ? err.message : "Erreur IBU inconnue.", unmatched: [] });
    } finally {
      setLoading(false);
    }
  }

  const count = startList.status === "known" ? Object.keys(startList.order).length : 0;
  const status =
    startList.status !== "known"
      ? format === "poursuite"
        ? "Pas encore connue : les pronostics ouvriront dès que les résultats du sprint seront saisis (60 premiers), ou dès que la liste IBU sera récupérée."
        : "Pas encore connue : les pronostics ne sont pas ouverts. Récupère la liste IBU dès sa publication (en général la veille de la course)."
      : startList.source === "ibu"
        ? `Liste officielle IBU enregistrée : ${count} biathlète(s) pronostiquable(s).`
        : `Déduite du sprint : ${count} biathlète(s) classé(s) dans les 60 premiers.`;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">Liste de départ</div>
      <p className="text-xs text-text-dim">{status}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleIbu}
          disabled={loading}
          className="rounded bg-ice px-4 py-1.5 text-sm font-bold text-on-ice disabled:opacity-60"
        >
          {loading ? "Lecture du site IBU..." : "Récupérer la liste de départ IBU"}
        </button>
        <input
          value={ibuRaceId}
          onChange={(e) => setIbuRaceId(e.target.value)}
          placeholder="Identifiant IBU (facultatif)"
          title="À renseigner seulement si la course n'est pas retrouvée automatiquement (visible dans l'adresse de la course sur biathlonresults.com)"
          className="w-60 rounded border border-border bg-bg px-2 py-1.5 text-xs"
        />
      </div>
      <p className="text-xs text-text-dim">
        Seuls les biathlètes de la liste apparaissent dans le pronostic, avec les cotes déjà validées (rien n&apos;est modifié dans les cotes).
      </p>
      {report && (
        <div className={`text-xs ${report.ok ? "text-ice" : "text-red"}`}>
          {report.message}
          {report.unmatched.length > 0 && (
            <div className="mt-1 text-text-dim">
              Sans cote dans le jeu (non pronostiquables) : {report.unmatched.join(", ")}.
            </div>
          )}
        </div>
      )}
      {startList.status === "known" && startList.source === "ibu" && (
        <form action={clearStartList}>
          <input type="hidden" name="race_id" value={raceId} />
          <ConfirmButton
            message="Effacer la liste de départ IBU de cette course ?"
            className="rounded border border-border px-3 py-1 text-xs text-text-dim hover:text-red"
          >
            Effacer la liste IBU
          </ConfirmButton>
        </form>
      )}
    </div>
  );
}
