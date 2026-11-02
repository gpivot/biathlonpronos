"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closeLiveQuestion,
  createBonusQuestion,
  deleteBonusQuestion,
  launchLiveQuestion,
  setBonusQuestionAnswer,
  type BonusQuestionActionResult,
} from "./bonusQuestionActions";
import {
  BONUS_QUESTION_POINTS,
  LIVE_QUESTION_DEFAULT_MINUTES,
  LIVE_QUESTION_MAX_MINUTES,
  type BonusQuestionKind,
  type BonusQuestionState,
} from "@/lib/bonusQuestions";

const inputClass = "rounded border border-border bg-bg px-2 py-1.5 text-sm";

export interface AdminBonusQuestion {
  id: string;
  kind: BonusQuestionKind;
  question: string;
  options: string[];
  state: BonusQuestionState;
  closesAt: string | null;
  correctOption: number | null;
  /** Nombre de réponses par option. */
  counts: number[];
}

const STATE_LABELS: Record<BonusQuestionState, string> = {
  draft: "Brouillon",
  scheduled: "Programmée",
  open: "Ouverte",
  closed: "Fermée",
};

/**
 * Questions bonus d'une course : création (avant le départ ou live), lancement d'une question live
 * (avec notification), fermeture, saisie de la bonne réponse (BONUS_QUESTION_POINTS pts pour chaque
 * joueur qui l'a trouvée) et suppression.
 */
export function BonusQuestionsPanel({ raceId, questions }: { raceId: string; questions: AdminBonusQuestion[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BonusQuestionActionResult | null>(null);
  const [kind, setKind] = useState<BonusQuestionKind>("pre_race");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [minutes, setMinutes] = useState<Record<string, number>>({});

  const run = (action: () => Promise<BonusQuestionActionResult>, onSuccess?: () => void) => {
    setResult(null);
    startTransition(async () => {
      const res = await action();
      setResult(res);
      if (res.ok) {
        onSuccess?.();
        router.refresh();
      }
    });
  };

  const optionCount = kind === "live" ? 2 : 4;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">Questions bonus (+{BONUS_QUESTION_POINTS} pts par bonne réponse)</div>

      {questions.length === 0 ? (
        <p className="text-xs text-text-dim">Aucune question pour cette course.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {questions.map((q) => {
            const total = q.counts.reduce((a, b) => a + b, 0);
            return (
              <li key={q.id} className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${q.kind === "live" ? "bg-red/15 text-red" : "bg-gold/15 text-gold"}`}>
                    {q.kind === "live" ? "Live" : "Avant le départ"}
                  </span>
                  <span className="text-text-dim">{STATE_LABELS[q.state]}</span>
                  {q.kind === "live" && q.closesAt && q.state === "open" && (
                    <span className="text-text-dim">
                      jusqu&apos;à {new Date(q.closesAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  )}
                  <span className="text-text-dim">· {total} réponse(s)</span>
                </div>
                <div className="text-sm font-semibold">{q.question}</div>
                <ul className="flex flex-col gap-0.5 text-xs text-frost">
                  {q.options.map((option, i) => (
                    <li key={i} className={q.correctOption === i ? "font-bold text-green" : ""}>
                      {q.correctOption === i ? "✓ " : ""}
                      {option} — <span className="text-text-dim">{q.counts[i] ?? 0}</span>
                    </li>
                  ))}
                </ul>
                {q.state === "closed" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-text-dim">
                      {q.correctOption === null ? "Bonne réponse à saisir :" : "Bonne réponse :"}
                    </span>
                    <select
                      value={q.correctOption ?? ""}
                      disabled={pending}
                      onChange={(e) => {
                        const value = e.target.value === "" ? null : Number(e.target.value);
                        const label = value === null ? "effacer la bonne réponse et retirer les points" : `valider « ${q.options[value]} »`;
                        if (window.confirm(`Confirmer : ${label} ?`)) run(() => setBonusQuestionAnswer(q.id, value));
                      }}
                      className={inputClass}
                    >
                      <option value="">—</option>
                      {q.options.map((option, i) => (
                        <option key={i} value={i}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {q.state === "draft" && (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={LIVE_QUESTION_MAX_MINUTES}
                        value={minutes[q.id] ?? LIVE_QUESTION_DEFAULT_MINUTES}
                        onChange={(e) => setMinutes({ ...minutes, [q.id]: Number(e.target.value) })}
                        className={`${inputClass} w-20`}
                        aria-label="Durée en minutes"
                      />
                      <span className="text-xs text-text-dim">min</span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          const duration = minutes[q.id] ?? LIVE_QUESTION_DEFAULT_MINUTES;
                          if (!window.confirm(`Lancer la question pendant ${duration} min et envoyer la notification à tous les joueurs ?`)) return;
                          run(() => launchLiveQuestion(q.id, duration));
                        }}
                        className="rounded bg-red px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60"
                      >
                        Lancer + notifier
                      </button>
                    </>
                  )}
                  {q.kind === "live" && q.state === "open" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => closeLiveQuestion(q.id))}
                      className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-60"
                    >
                      Fermer maintenant
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const message =
                        total > 0
                          ? `Supprimer cette question ? Ses ${total} réponse(s) et les points déjà attribués seront retirés aux joueurs.`
                          : "Supprimer cette question ?";
                      if (window.confirm(message)) run(() => deleteBonusQuestion(q.id));
                    }}
                    className="rounded border border-red/50 px-3 py-1.5 text-sm text-red disabled:opacity-60"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="text-xs font-semibold text-text-dim">Nouvelle question</div>
        <div className="flex flex-wrap gap-2 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={kind === "pre_race"} onChange={() => setKind("pre_race")} />
            Avant le départ (2 à 4 réponses, sans notification)
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={kind === "live"} onChange={() => setKind("live")} />
            Live (2 réponses, à lancer pendant la course)
          </label>
        </div>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          placeholder="Question"
          className={inputClass}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          {options.slice(0, optionCount).map((option, i) => (
            <input
              key={i}
              value={option}
              onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
              maxLength={80}
              placeholder={`Réponse ${i + 1}${i >= 2 ? " (facultative)" : ""}`}
              className={inputClass}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () => createBonusQuestion({ raceId, kind, question, options: options.slice(0, optionCount) }),
              () => {
                setQuestion("");
                setOptions(["", "", "", ""]);
              }
            )
          }
          className="w-fit rounded bg-ice px-4 py-1.5 text-sm font-bold text-on-ice disabled:opacity-60"
        >
          {kind === "live" ? "Enregistrer (brouillon)" : "Publier la question"}
        </button>
        <p className="text-xs text-text-dim">
          Avant le départ : visible sur la page de la course dès l&apos;ouverture des pronostics, réponses possibles jusqu&apos;au
          départ. Live : prépare-la à l&apos;avance, puis clique sur « Lancer + notifier » pendant la course. Une fois la
          question fermée, saisis la bonne réponse : les points sont alors attribués.
        </p>
      </div>

      {result && (
        <div className={`text-sm font-semibold ${result.ok ? "text-green" : "text-red"}`} role={result.ok ? "status" : "alert"}>
          {result.message}
        </div>
      )}
    </div>
  );
}
