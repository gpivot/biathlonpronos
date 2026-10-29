"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Compte à rebours jusqu'au départ (= verrouillage) d'une course. `serverNow`
 * est l'heure du serveur au rendu (horloge simulée de l'admin comprise) : le
 * décompte part de là et avance au rythme de l'horloge du navigateur.
 */
export function Countdown({ target, serverNow }: { target: string; serverNow: number }) {
  const t = useTranslations("Home");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const mountedAt = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - mountedAt), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, new Date(target).getTime() - serverNow - elapsed);
  if (remaining === 0) return <span className="font-display text-xs font-bold text-gold">{t("countdownStarted")}</span>;

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const clock = `${pad(Math.floor((totalSeconds % 86400) / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`;

  return (
    <span className="font-display text-xs font-bold tabular-nums text-ice">
      {t("countdown", { time: days > 0 ? `${t("countdownDays", { days })} ${clock}` : clock })}
    </span>
  );
}
