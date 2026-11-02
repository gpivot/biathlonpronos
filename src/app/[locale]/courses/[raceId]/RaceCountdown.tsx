"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

/**
 * Compte à rebours en haut de la page course, tant qu'elle n'a pas démarré :
 * - pronostics pas encore ouverts : temps restant avant leur ouverture ;
 * - pronostics ouverts : temps restant pour pronostiquer (jusqu'au départ = verrouillage).
 * `serverNow` est l'heure du serveur au rendu (horloge simulée de l'admin comprise), le décompte
 * avance ensuite au rythme du navigateur. À zéro, la page se recharge pour passer à l'étape suivante.
 */
export function RaceCountdown({
  target,
  serverNow,
  mode,
}: {
  target: string;
  serverNow: number;
  mode: "opening" | "lock";
}) {
  const t = useTranslations("Race");
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const refreshed = useRef(false);

  useEffect(() => {
    const mountedAt = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - mountedAt), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, new Date(target).getTime() - serverNow - elapsed);

  useEffect(() => {
    if (remaining === 0 && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [remaining, router]);

  const totalSeconds = Math.floor(remaining / 1000);
  const units = [
    { value: Math.floor(totalSeconds / 86400), label: t("countdownUnitDays") },
    { value: Math.floor((totalSeconds % 86400) / 3600), label: t("countdownUnitHours") },
    { value: Math.floor((totalSeconds % 3600) / 60), label: t("countdownUnitMinutes") },
    { value: totalSeconds % 60, label: t("countdownUnitSeconds") },
  ];
  // Jours masqués quand il en reste zéro ; dernière heure avant le départ en doré pour presser le joueur.
  const shown = units[0].value > 0 ? units : units.slice(1);
  const urgent = mode === "lock" && remaining < 3600 * 1000;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-[18px] border px-4 py-3 ${
        urgent ? "border-gold/60 bg-gold-soft" : "border-ice/40 bg-ice-soft"
      }`}
      role="timer"
      aria-live="off"
    >
      <div className={`font-display text-[12px] font-bold uppercase leading-tight tracking-wider ${urgent ? "text-gold" : "text-ice"}`}>
        ⏳ {t(mode === "opening" ? "countdownToOpening" : "countdownToLock")}
      </div>
      <div className="flex gap-1.5">
        {shown.map((u) => (
          <div key={u.label} className="flex min-w-[38px] flex-col items-center rounded-lg bg-card px-1.5 py-1">
            <span className={`font-display text-lg font-extrabold leading-none tabular-nums ${urgent ? "text-gold" : "text-frost"}`}>
              {u.value.toString().padStart(2, "0")}
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase text-text-dim">{u.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
