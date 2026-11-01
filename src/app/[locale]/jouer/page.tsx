"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/icons";
import { findNextPlayableRace } from "./actions";

/**
 * Bouton « Jouer » de l'accueil (parcours d'invité, 01/11/2026) : ouvre une session invitée
 * (connexion anonyme Supabase) si personne n'est connecté, puis la prochaine course disponible.
 * Le compte n'est demandé qu'à la validation du premier pronostic.
 */
export default function PlayPage() {
  const t = useTranslations("Guest");
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const { error } = await supabase.auth.signInAnonymously();
        // Connexion invitée indisponible (désactivée, limite atteinte) : la course reste visible,
        // le compte sera créé à la validation du pronostic.
        if (error) console.error("signInAnonymously:", error.message);
      }
      const raceId = await findNextPlayableRace().catch(() => null);
      if (cancelled) return;
      if (raceId) router.replace(`/courses/${raceId}`);
      else setFailed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <LogoMark className="h-14 w-14 text-ice" />
      {failed ? (
        <>
          <p className="text-sm text-text-dim">{t("noRace")}</p>
          <Link href="/courses" className="rounded-full bg-ice px-5 py-2.5 font-display text-sm font-bold text-on-ice">
            {t("seeCalendar")}
          </Link>
        </>
      ) : (
        <p className="animate-pulse text-sm text-text-dim">{t("loadingRace")}</p>
      )}
    </div>
  );
}
