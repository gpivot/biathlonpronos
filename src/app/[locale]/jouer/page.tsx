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
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session && !session.user.is_anonymous) setSignedIn(true);
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
          {/* Pas de course ouverte : on propose de se connecter (ou créer son compte) pour être
              prêt à la prochaine, et le calendrier pour voir quand elle ouvre. */}
          {!signedIn && (
            <Link href="/sign-in" className="rounded-full bg-ice px-5 py-2.5 font-display text-sm font-bold text-on-ice">
              {t("signInLink")}
            </Link>
          )}
          <Link
            href="/courses"
            className={
              signedIn
                ? "rounded-full bg-ice px-5 py-2.5 font-display text-sm font-bold text-on-ice"
                : "rounded-full border border-border px-5 py-2.5 font-display text-sm font-bold text-text"
            }
          >
            {t("seeCalendar")}
          </Link>
        </>
      ) : (
        <p className="animate-pulse text-sm text-text-dim">{t("loadingRace")}</p>
      )}
    </div>
  );
}
