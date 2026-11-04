"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CheckIcon } from "@/components/icons";
import { answerBonusQuestion } from "@/lib/bonusQuestionActions";
import { BONUS_QUESTION_POINTS, type PlayerBonusQuestion } from "@/lib/bonusQuestions";

/** Millisecondes restantes jusqu'à `closesAt`, recalculées chaque seconde (null : pas de décompte). */
export function useRemaining(remainingAtRender: number | null): number | null {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (remainingAtRender == null) return;
    const mountedAt = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - mountedAt), 1000);
    return () => clearInterval(id);
  }, [remainingAtRender]);
  return remainingAtRender == null ? null : Math.max(0, remainingAtRender - elapsed);
}

export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Badge « +20 pts » des questions bonus, le même partout (page course, résultats). */
export function BonusPointsBadge({ label }: { label?: string }) {
  const t = useTranslations("BonusQuestions");
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-green/15 px-2.5 py-1 font-display text-[11px] font-bold text-green">
      ❓ {label ?? t("pointsBadge", { points: BONUS_QUESTION_POINTS })}
    </span>
  );
}

/**
 * Questions bonus d'une course (page de la course). `remainingMs` : temps restant de chaque question
 * live ouverte au moment du rendu, par id (le décompte continue dans le navigateur).
 */
export function BonusQuestions({
  questions,
  remainingMs,
  signedIn,
}: {
  questions: PlayerBonusQuestion[];
  remainingMs: Record<string, number>;
  signedIn: boolean;
}) {
  const t = useTranslations("BonusQuestions");
  if (questions.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">{t("sectionTitle")}</div>
      {questions.map((q) => (
        <BonusQuestionCard key={q.id} question={q} remainingMs={remainingMs[q.id] ?? null} signedIn={signedIn} />
      ))}
    </div>
  );
}

function BonusQuestionCard({
  question,
  remainingMs,
  signedIn,
}: {
  question: PlayerBonusQuestion;
  remainingMs: number | null;
  signedIn: boolean;
}) {
  const t = useTranslations("BonusQuestions");
  const router = useRouter();
  const [answer, setAnswer] = useState<number | null>(question.myAnswer);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Passe à vrai après un enregistrement réussi dans cette visite : l'encart de confirmation « saute » pour être remarqué.
  const [justSaved, setJustSaved] = useState(0);
  const remaining = useRemaining(question.kind === "live" && question.state === "open" ? remainingMs : null);
  const open = question.state === "open" && (remaining == null || remaining > 0);
  const live = question.kind === "live";

  function choose(index: number) {
    if (!open || pending || !signedIn) return;
    const previous = answer;
    setAnswer(index);
    setError(null);
    setJustSaved(0);
    startTransition(async () => {
      const result = await answerBonusQuestion(question.id, index);
      if (!result.ok) {
        setAnswer(previous);
        setError(t(`error_${result.error}`));
      } else {
        setJustSaved((n) => n + 1);
        router.refresh();
      }
    });
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-4 ${
        live && open ? "border-red/60 bg-gradient-to-br from-red/10 to-card" : "border-gold/50 bg-gradient-to-br from-gold/10 to-card"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={`font-display text-[11px] font-bold uppercase tracking-wider ${live && open ? "text-red" : "text-gold"}`}>
          {live ? `🔴 ${t("liveLabel")}` : `❓ ${t("preRaceLabel")}`} · +{BONUS_QUESTION_POINTS} pts
        </div>
        {live && open && remaining != null && (
          <span className="font-display text-xs font-bold tabular-nums text-red">{t("remaining", { time: formatRemaining(remaining) })}</span>
        )}
        {!open && <span className="font-display text-[11px] font-bold text-text-dim">{t("closed")}</span>}
      </div>

      <div className="text-[15px] font-semibold leading-snug text-frost">{question.question}</div>

      <div className={`grid gap-2 ${question.options.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        {question.options.map((option, index) => {
          const selected = answer === index;
          // Bonne réponse connue : en vert ; réponse du joueur fausse : en rouge.
          const correct = question.correctOption === index;
          const wrong = selected && question.correctOption !== null && !correct;
          const tone = correct
            ? "border-green bg-green/15 text-green"
            : wrong
              ? "border-red/70 bg-red/10 text-red"
              : selected
                ? "border-ice bg-ice-soft text-ice"
                : "border-border bg-card text-frost";
          return (
            <button
              key={index}
              type="button"
              disabled={!open || pending || !signedIn}
              onClick={() => choose(index)}
              aria-pressed={selected}
              className={`flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${tone} ${
                open && signedIn ? "" : "cursor-default"
              } ${!open && !selected && !correct ? "opacity-60" : ""}`}
            >
              <span
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                  correct ? "border-green bg-green" : wrong ? "border-red bg-red" : selected ? "border-ice bg-ice" : "border-border"
                }`}
              >
                {(selected || correct) && <CheckIcon className="h-3 w-3 text-on-ice" />}
              </span>
              <span className="flex-1">{option}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="text-[13px] font-semibold text-red">
          {error}
        </div>
      )}
      {question.correctOption !== null ? (
        answer === question.correctOption ? (
          <div className="flex flex-wrap items-center gap-2">
            <BonusPointsBadge />
            <span className="text-[12px] font-semibold text-green">{t("correct")}</span>
          </div>
        ) : (
          <div className="text-[12px] font-semibold text-text-dim">{answer === null ? t("notAnswered") : t("wrong")}</div>
        )
      ) : answer !== null && pending ? (
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-sm font-semibold text-text-dim">
          <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-ice border-t-transparent" />
          {t("saving")}
        </div>
      ) : answer !== null ? (
        // Confirmation bien visible que le choix est enregistré (même encart que « Ton pronostic est validé ! »).
        <div
          key={justSaved}
          role="status"
          className={`flex items-center gap-3 rounded-2xl border border-ice bg-ice-soft px-3.5 py-3 ${justSaved ? "animate-save-pop" : ""}`}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ice">
            <CheckIcon className="h-4 w-4 text-on-ice" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-bold text-frost">{t("savedTitle")}</span>
            <span className="text-[12px] text-text-dim">
              {t("savedChoice", { option: question.options[answer] ?? "" })}{" "}
              {open ? t("canChange", { points: BONUS_QUESTION_POINTS }) : t("resultSoon")}
            </span>
          </div>
        </div>
      ) : !signedIn ? (
        <div className="text-[12px] text-text-dim">{t("signInToAnswer")}</div>
      ) : open ? (
        <div className="text-[12px] text-text-dim">{t("answerToEarn", { points: BONUS_QUESTION_POINTS })}</div>
      ) : (
        <div className="text-[12px] text-text-dim">{t("notAnswered")}</div>
      )}
    </div>
  );
}
