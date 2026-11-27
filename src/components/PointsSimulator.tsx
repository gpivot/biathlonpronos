"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { COMBINATION_BONUS, RANK_MULTIPLIERS } from "@/lib/scoring/constants";

/**
 * Simulateur de points de la page Règles (27/11/2026) : le joueur règle la cote et la place de
 * ses 3 biathlètes et voit le calcul (cote × multiplicateur, bonus de combinaison). Mêmes
 * constantes que le moteur de scoring ; le Prono parfait et les cartes ne sont pas simulés.
 */
const OUT = 11; // « 11e ou plus » : hors du Top 10.
const PLACES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, OUT];

function comboBonus(places: number[]): { key: "comboPodium" | "comboTop5" | "comboTop10"; points: number } | null {
  const worst = Math.max(...places);
  if (worst <= 3) return { key: "comboPodium", points: COMBINATION_BONUS.podium };
  if (worst <= 5) return { key: "comboTop5", points: COMBINATION_BONUS.top5 };
  if (worst <= 10) return { key: "comboTop10", points: COMBINATION_BONUS.top10 };
  return null;
}

export function PointsSimulator() {
  const t = useTranslations("Regles");
  const [picks, setPicks] = useState([
    { odds: 8, place: 1 },
    { odds: 12, place: 2 },
    { odds: 22, place: 6 },
  ]);
  const rankLabel = (n: number) => (n === OUT ? t("simOut") : t("rank", { rank: n }));
  const update = (i: number, patch: Partial<{ odds: number; place: number }>) =>
    setPicks((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const lines = picks.map((p) => {
    const mult = RANK_MULTIPLIERS[p.place];
    return { ...p, mult, points: mult ? p.odds * mult : 0 };
  });
  const bonus = comboBonus(picks.map((p) => p.place));
  const total = lines.reduce((sum, l) => sum + l.points, 0) + (bonus?.points ?? 0);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gold/50 bg-gold-soft p-4">
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-[15px] font-extrabold">🧮 {t("simTitle")}</span>
        <span className="text-[12px] leading-snug text-text-dim">{t("simIntro")}</span>
      </div>

      {lines.map((line, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-[12px] font-bold text-text-dim">{t("simPick", { n: i + 1 })}</span>
            <span className={`font-display text-[13px] font-extrabold ${line.points > 0 ? "text-gold" : "text-text-dim"}`}>
              {line.mult ? `${line.odds} × ${line.mult} = ${line.points} pts` : t("simNoPoints")}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[11px] text-text-dim">
              <span>
                {t("oddsShort")} <b className="font-display text-ice">{line.odds}</b>
              </span>
              <input
                type="range"
                min={1}
                max={50}
                value={line.odds}
                onChange={(e) => update(i, { odds: Number(e.target.value) })}
                className="accent-ice"
                aria-label={`${t("simPick", { n: i + 1 })} · ${t("oddsShort")}`}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-text-dim">
              <span>{t("simPlace")}</span>
              <select
                value={line.place}
                onChange={(e) => update(i, { place: Number(e.target.value) })}
                className="rounded-lg border border-border bg-card2 px-2 py-1 font-display text-[13px] font-bold text-text"
              >
                {PLACES.map((p) => (
                  <option key={p} value={p}>
                    {rankLabel(p)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between gap-2 px-1 text-[13px]">
        <span className="text-text-dim">{bonus ? `${t(`${bonus.key}Name`)} (${t("simBonus")})` : t("simNoBonus")}</span>
        <span className={`font-display font-extrabold ${bonus ? "text-green" : "text-text-dim"}`}>+{bonus?.points ?? 0}</span>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2">
        <span className="font-display text-[13px] font-bold">{t("simTotal")}</span>
        <span className="font-display text-xl font-extrabold text-gold">{total} pts</span>
      </div>
    </div>
  );
}
