"use client";

import { useState } from "react";
import { clearStartList, loadGeneralStartList, loadIbuStartList, type StartListImportState } from "./actions";
import { ConfirmButton } from "../../_components/ConfirmButton";
import { GENERAL_FIELD_FORMATS, type NationStartList, type StartList } from "@/lib/startList";
import { RELAY_FORMATS } from "@/lib/raceFormats";

/**
 * Liste de départ d'une course. Sprint, individuel, relais : liste provisoire placée toute seule à
 * l'ouverture du lundi 17 h (top 60 du général, nations du général du relais), puis liste
 * officielle IBU récupérée à la main. Poursuite / mass start : qualifiés seulement.
 */
export function StartListPanel({
  raceId,
  format,
  startList,
  nationList,
  opensAt,
}: {
  raceId: string;
  format: string;
  startList: StartList | null;
  nationList: NationStartList | null;
  opensAt: string;
}) {
  const [loading, setLoading] = useState<"ibu" | "general" | null>(null);
  const [ibuRaceId, setIbuRaceId] = useState("");
  const [report, setReport] = useState<StartListImportState | null>(null);
  const isRelay = RELAY_FORMATS.includes(format);
  const hasGeneralField = isRelay || GENERAL_FIELD_FORMATS.includes(format);

  async function run(kind: "ibu" | "general") {
    setLoading(kind);
    setReport(null);
    try {
      setReport(kind === "ibu" ? await loadIbuStartList(raceId, ibuRaceId || undefined) : await loadGeneralStartList(raceId));
    } catch (err) {
      setReport({ ok: false, message: err instanceof Error ? err.message : "Erreur IBU inconnue.", unmatched: [] });
    } finally {
      setLoading(null);
    }
  }

  const opening = new Date(opensAt).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  let status: string;
  let source: "ibu" | "general" | "sprint" | null = null;
  if (isRelay) {
    source = nationList?.source ?? null;
    status = !nationList
      ? `Pas encore de liste : toutes les nations cotées sont proposées. La liste provisoire (nations du général du relais) se place toute seule avant l'ouverture (${opening}).`
      : nationList.source === "general"
        ? `Liste provisoire (général du relais) : ${nationList.nations.length} nation(s). Récupère la liste officielle IBU dès sa publication, en général la veille vers 17-18 h.`
        : `Liste officielle IBU enregistrée : ${nationList.nations.length} nation(s) pronostiquable(s).`;
  } else if (!startList || startList.status !== "known") {
    status = hasGeneralField
      ? `Pas encore de liste : tous les biathlètes cotés sont proposés. Les 60 premiers du général se placent tout seuls avant l'ouverture (${opening}).`
      : format === "poursuite"
        ? "Pas encore connue : les pronostics ouvriront dès que les résultats du sprint seront saisis (60 premiers), ou dès que la liste IBU sera récupérée."
        : "Pas encore connue : les pronostics ne sont pas ouverts. Récupère la liste IBU dès sa publication (en général la veille de la course).";
  } else {
    source = startList.source;
    const count = Object.keys(startList.order).length;
    status =
      startList.source === "ibu"
        ? `Liste officielle IBU enregistrée : ${count} biathlète(s) pronostiquable(s).`
        : startList.source === "general"
          ? `Liste provisoire : ${count} biathlète(s) parmi les 60 premiers du général. Récupère la liste officielle IBU dès sa publication, en général la veille vers 17-18 h.`
          : `Déduite du sprint : ${count} biathlète(s) classé(s) dans les 60 premiers.`;
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">Liste de départ</div>
      <p className="text-xs text-text-dim">Ouverture des pronostics de l&apos;étape : {opening}.</p>
      <p className="text-xs text-text-dim">{status}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => run("ibu")}
          disabled={loading !== null}
          className="rounded bg-ice px-4 py-1.5 text-sm font-bold text-on-ice disabled:opacity-60"
        >
          {loading === "ibu" ? "Lecture du site IBU..." : "Récupérer la liste de départ définitive (IBU)"}
        </button>
        <input
          value={ibuRaceId}
          onChange={(e) => setIbuRaceId(e.target.value)}
          placeholder="Identifiant IBU (facultatif)"
          title="À renseigner seulement si la course n'est pas retrouvée automatiquement (visible dans l'adresse de la course sur biathlonresults.com)"
          className="w-60 rounded border border-border bg-bg px-2 py-1.5 text-xs"
        />
      </div>
      {hasGeneralField && (
        <div>
          <button
            type="button"
            onClick={() => run("general")}
            disabled={loading !== null}
            className="rounded border border-border px-3 py-1 text-xs text-text-dim hover:text-text disabled:opacity-60"
          >
            {loading === "general"
              ? "Lecture du classement IBU..."
              : isRelay
                ? "Replacer les nations du général du relais"
                : "Replacer les 60 premiers du général"}
          </button>
        </div>
      )}
      <p className="text-xs text-text-dim">
        Seuls les {isRelay ? "nations" : "biathlètes"} de la liste apparaissent dans le pronostic, avec les cotes déjà validées (rien n&apos;est modifié dans les cotes).
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
      {(source === "ibu" || source === "general") && (
        <form action={clearStartList}>
          <input type="hidden" name="race_id" value={raceId} />
          <ConfirmButton
            message="Effacer la liste de départ de cette course ?"
            className="rounded border border-border px-3 py-1 text-xs text-text-dim hover:text-red"
          >
            Effacer la liste
          </ConfirmButton>
        </form>
      )}
    </div>
  );
}
