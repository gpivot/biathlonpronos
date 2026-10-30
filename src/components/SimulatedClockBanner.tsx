"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resetSimulatedClock } from "@/app/admin/horloge/actions";
import { SIMULATED_CLOCK_COOKIE, parseClockOffset } from "@/lib/simulatedClock";
import { DISPLAY_TIME_ZONE } from "@/lib/displayTimeZone";

/**
 * Bandeau affiché tant que l'horloge simulée de l'admin est active, pour ne
 * jamais confondre la simulation avec l'état réel du jeu. Lu côté navigateur
 * (le cookie n'est posé que par l'action admin) afin de ne pas rendre
 * dynamiques les pages statiques.
 */
export function SimulatedClockBanner() {
  const router = useRouter();
  const [offset, setOffset] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const read = () => {
      const raw = document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${SIMULATED_CLOCK_COOKIE}=`))
        ?.split("=")[1];
      setOffset(parseClockOffset(raw));
    };
    read();
    const interval = setInterval(() => {
      read();
      setTick((t) => t + 1);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (offset === null) return null;

  const simulatedNow = new Date(Date.now() + offset);

  return (
    <div className="sticky top-[env(safe-area-inset-top)] z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-gold px-4 py-1.5 text-center text-xs font-semibold text-bg">
      <span>
        Horloge simulée :{" "}
        {simulatedNow.toLocaleString("fr-FR", { timeZone: DISPLAY_TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </span>
      <a href="/admin/horloge" className="underline">
        Régler
      </a>
      <button
        type="button"
        className="underline"
        onClick={async () => {
          await resetSimulatedClock();
          setOffset(null);
          router.refresh();
        }}
      >
        Heure réelle
      </button>
    </div>
  );
}
