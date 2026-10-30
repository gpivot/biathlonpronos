"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Filtres du Classement, portés par l'URL (`?portee=ligue&ligue=…&periode=etapes&etape=…&course=…`)
 * pour que la page serveur recharge le bon classement et qu'un lien garde le filtre.
 */
export interface StandingsFilterState {
  scope: "general" | "league";
  leagueId: string | null;
  period: "season" | "stages";
  stageId: string | null;
  raceId: string | null;
}

export interface StandingsFilterOptions {
  leagues: { id: string; name: string }[];
  stages: { id: string; label: string; races: { id: string; label: string }[] }[];
}

export function StandingsFilters({ state, options }: { state: StandingsFilterState; options: StandingsFilterOptions }) {
  const t = useTranslations("Classement");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const go = (next: Partial<StandingsFilterState>) => {
    const s = { ...state, ...next };
    const params = new URLSearchParams();
    if (s.scope === "league") {
      params.set("portee", "ligue");
      if (s.leagueId) params.set("ligue", s.leagueId);
    }
    if (s.period === "stages") {
      params.set("periode", "etapes");
      if (s.stageId) params.set("etape", s.stageId);
      if (s.raceId) params.set("course", s.raceId);
    }
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const stage = options.stages.find((s) => s.id === state.stageId) ?? null;

  return (
    <div className={`flex flex-col gap-2.5 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <Segmented
        value={state.scope}
        options={[
          { value: "general", label: t("filterGeneral") },
          { value: "league", label: t("filterLeague") },
        ]}
        onChange={(scope) => go({ scope, leagueId: scope === "league" ? state.leagueId ?? options.leagues[0]?.id ?? null : null })}
      />
      {state.scope === "league" && options.leagues.length > 0 && (
        <Select
          value={state.leagueId ?? ""}
          onChange={(leagueId) => go({ leagueId })}
          options={options.leagues.map((l) => ({ value: l.id, label: l.name }))}
        />
      )}

      <Segmented
        value={state.period}
        options={[
          { value: "season", label: t("filterSeason") },
          { value: "stages", label: t("filterStages") },
        ]}
        onChange={(period) => go({ period, stageId: period === "stages" ? state.stageId : null, raceId: null })}
      />
      {state.period === "stages" && options.stages.length > 0 && (
        <div className="flex gap-2">
          <Select
            value={state.stageId ?? ""}
            onChange={(stageId) => go({ stageId, raceId: null })}
            options={options.stages.map((s) => ({ value: s.id, label: s.label }))}
          />
          {stage && stage.races.length > 0 && (
            <Select
              value={state.raceId ?? ""}
              onChange={(raceId) => go({ raceId: raceId || null })}
              options={[{ value: "", label: t("filterAllRaces") }, ...stage.races.map((r) => ({ value: r.id, label: r.label }))]}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full border border-border bg-card p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => o.value !== value && onChange(o.value)}
          className={`flex-1 rounded-full py-2 font-display text-[13px] font-bold transition-colors ${
            o.value === value ? "bg-ice text-on-ice" : "text-text-dim"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-frost"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
