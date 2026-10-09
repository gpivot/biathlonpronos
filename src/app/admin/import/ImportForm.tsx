"use client";

import { useRef, useState } from "react";
import { runImport } from "./actions";
import type { ImportSummary } from "@/lib/admin/csvImport";

function UploadSection({
  title,
  hint,
  onImport,
}: {
  title: string;
  hint: string;
  onImport: (csvText: string) => Promise<ImportSummary>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const csvText = await file.text();
      const result = await onImport(csvText);
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">{title}</div>
      <p className="text-xs text-text-dim">{hint}</p>
      <div className="flex items-center gap-2">
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="text-sm" />
        <button
          onClick={handleImport}
          disabled={loading}
          className="rounded bg-ice px-4 py-1.5 text-sm font-bold text-[#062024] disabled:opacity-60"
        >
          {loading ? "Import en cours..." : "Importer"}
        </button>
      </div>

      {error && <div className="text-sm text-red">{error}</div>}

      {summary && (
        <div className="flex flex-col gap-1 text-xs">
          <div className="text-ice">
            {summary.athletesCreated} athlète(s) créé(s), {summary.athletesUpdated} mis à jour,{" "}
            {summary.oddsRowsWritten} cote(s) écrite(s).
          </div>
          {summary.warnings.length > 0 && (
            <ul className="list-disc pl-4 text-gold">
              {summary.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ImportForm({ seasonId }: { seasonId: string }) {
  return (
    <div className="flex flex-col gap-4">
      <UploadSection
        title="Cotes — Femmes"
        hint="Colonnes : nom, prénom, nationalité, globe, jeune, nation, sprint, poursuite, individuel, mass, relais"
        onImport={(csvText) => runImport(seasonId, "F", csvText)}
      />
      <UploadSection
        title="Cotes — Hommes"
        hint="Colonnes : nom, prénom, nationalité, globe, jeune, nation, sprint, poursuite, individuel, mass, relais"
        onImport={(csvText) => runImport(seasonId, "H", csvText)}
      />
      <UploadSection
        title="Cotes — Relais mixtes"
        hint="Colonnes : nation, mixte, simple"
        onImport={(csvText) => runImport(seasonId, "mixte", csvText)}
      />
    </div>
  );
}
