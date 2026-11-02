"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { fetchLiveQuestionInvites, type LiveQuestionInvite } from "@/lib/bonusQuestionActions";
import { BONUS_QUESTION_POINTS } from "@/lib/bonusQuestions";
import { formatRemaining, useRemaining } from "./BonusQuestions";

const DISMISSED_KEY = "dismissedLiveQuestions";
const POLL_MS = 60_000;

/** Encadré « Question live » : accueil et pop-up, avec le temps restant et un bouton vers la course. */
export function LiveQuestionInviteCard({ invite, onAnswer }: { invite: LiveQuestionInvite; onAnswer?: () => void }) {
  const t = useTranslations("BonusQuestions");
  const remaining = useRemaining(invite.remainingMs);
  if (remaining === 0) return null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-red/60 bg-gradient-to-br from-red/15 to-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="font-display text-[11px] font-bold uppercase tracking-wider text-red">
          🔴 {t("liveLabel")} · +{BONUS_QUESTION_POINTS} pts
        </div>
        {remaining != null && (
          <span className="font-display text-xs font-bold tabular-nums text-red">{t("remaining", { time: formatRemaining(remaining) })}</span>
        )}
      </div>
      <div className="text-[15px] font-semibold leading-snug text-frost">{invite.question}</div>
      <Link
        href={`/courses/${invite.raceId}`}
        onClick={onAnswer}
        className="rounded-full bg-red py-2.5 text-center font-display text-[13px] font-bold text-white"
      >
        {t("answerButton", { points: BONUS_QUESTION_POINTS })}
      </Link>
    </div>
  );
}

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/**
 * Pop-up des questions live : relit les questions ouvertes à chaque changement de page et toutes
 * les minutes (page visible), et propose celle à laquelle le joueur n'a pas encore répondu. Fermé,
 * il ne revient pas pour cette question.
 */
export function LiveQuestionPopup() {
  const t = useTranslations("BonusQuestions");
  const pathname = usePathname();
  const [invites, setInvites] = useState<LiveQuestionInvite[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const refresh = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    fetchLiveQuestionInvites()
      .then(setInvites)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refresh]);

  // Ni sur l'accueil (encadré en tête de page) ni sur la page de la course (question affichée).
  const invite =
    pathname === "/" ? undefined : invites.find((i) => !dismissed.includes(i.id) && !pathname.startsWith(`/courses/${i.raceId}`));
  if (!invite) return null;

  const dismiss = () => {
    const next = [...dismissed, invite.id].slice(-50);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {}
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("liveLabel")}
      onClick={dismiss}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
    >
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-2">
        <div className="rounded-2xl bg-card">
          <LiveQuestionInviteCard key={invite.id} invite={invite} onAnswer={dismiss} />
        </div>
        <button type="button" onClick={dismiss} className="py-2 text-center font-display text-[13px] font-bold text-white/80">
          {t("later")}
        </button>
      </div>
    </div>
  );
}
