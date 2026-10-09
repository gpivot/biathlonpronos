"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { runCalendarImport } from "./actions";
import type { CalendarImportSummary } from "@/lib/admin/calendarImport";

export function CalendarImportButton({ seasonId }: { seasonId: string }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<CalendarImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const t = useTranslations("Courses");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const csvText = await file.text();
      const result = await runCalendarImport(seasonId, csvText);
      setSummary(result);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="rounded-full border border-dashed border-border bg-card py-2.5 text-center font-display text-[13px] font-bold text-frost disabled:opacity-50"
      >
        {loading ? t("importLoading") : t("importButton")}
      </button>

      {error && <div className="text-xs text-red">{error}</div>}

      {summary && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-[12px] text-text-dim">
          <div>
            {t("importSummary", {
              stagesCreated: summary.stagesCreated,
              stagesUpdated: summary.stagesUpdated,
              racesCreated: summary.racesCreated,
              racesUpdated: summary.racesUpdated,
            })}
          </div>
          {summary.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 text-gold">
              {summary.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
