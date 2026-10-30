"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { CheckIcon } from "@/components/icons";
import { PredictionSummary } from "./PredictionSummary";
import { RuleInfoButton } from "./RuleInfoButton";
import { shortAthleteName } from "@/lib/athleteName";

export type AthleteWithOdds = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  nation_code: string;
  value: number;
};

type CardChoice = "none" | "balle_de_pioche" | "ca_farte";

export function PredictionForm({
  raceId,
  format,
  athletes,
  initialSelection,
  grilledAthleteIds,
  playableCards,
  activeCard,
  initialBonusX2,
  initialCardTarget,
  x2Eligible,
  x2UsesRemaining,
  startOrder = {},
  startGaps = {},
}: {
  raceId: string;
  format: string;
  athletes: AthleteWithOdds[];
  initialSelection: string[];
  grilledAthleteIds: string[];
  /** Cartes que le joueur peut encore jouer sur cette course (une seule carte à la fois). */
  playableCards: { id: string; card_type: string }[];
  /** Carte déjà jouée qui couvre cette course (4e choix sur sa fenêtre, ou Ça farte posé ici). */
  activeCard: "ca_farte" | "balle_de_pioche" | null;
  initialBonusX2: boolean;
  initialCardTarget: string | null;
  x2Eligible: boolean;
  x2UsesRemaining: number;
  /** Poursuite : place de départ (= classement du sprint) par athlète. Vide sinon. */
  startOrder?: Record<string, number>;
  /** Poursuite : retard au départ en secondes entières par athlète. */
  startGaps?: Record<string, number>;
}) {
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const [cardChoice, setCardChoice] = useState<CardChoice>(activeCard ?? "none");
  const [caFarteTarget, setCaFarteTarget] = useState<string | null>(initialCardTarget);
  const [bonusX2, setBonusX2] = useState(initialBonusX2);
  const hasStartOrder = Object.keys(startOrder).length > 0;
  // Poursuite : affichage par ordre de départ par défaut, ou par cote.
  const [sortBy, setSortBy] = useState<"start" | "odds">(hasStartOrder ? "start" : "odds");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dernier pronostic enregistré, pour signaler une modification pas encore validée.
  const [savedState, setSavedState] = useState(() => ({
    key: [...initialSelection].sort().join(","),
    bonusX2: initialBonusX2,
    card: activeCard as string | null,
    target: initialCardTarget,
  }));
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("PredictionForm");

  const grilledSet = new Set(grilledAthleteIds);
  const hasBalleDePioche = playableCards.some((c) => c.card_type === "balle_de_pioche");
  const hasCaFarte = playableCards.some((c) => c.card_type === "ca_farte");
  const canUseX2 = x2Eligible && (initialBonusX2 || x2UsesRemaining > 0);
  // 4e choix : jusqu'à 4 biathlètes (3 suffisent), les 3 meilleurs comptent.
  const requiredCount = cardChoice === "balle_de_pioche" ? 4 : 3;
  const canSubmit = cardChoice === "balle_de_pioche" ? selected.length >= 3 && selected.length <= 4 : selected.length === 3;

  function toggle(athleteId: string) {
    setSelected((prev) => {
      if (prev.includes(athleteId)) return prev.filter((id) => id !== athleteId);
      // Un biathlète grillé peut être retiré du pronostic, pas ajouté.
      if (grilledSet.has(athleteId)) return prev;
      if (prev.length >= requiredCount) return prev;
      return [...prev, athleteId];
    });
  }

  function changeCard(next: CardChoice) {
    setCardChoice(next);
    if (next !== "ca_farte") setCaFarteTarget(null);
    if (next !== "balle_de_pioche" && selected.length > 3) setSelected((prev) => prev.slice(0, 3));
  }

  async function submit() {
    if (cardChoice === "ca_farte" && !caFarteTarget) {
      setError(t("caFarteTargetRequired"));
      return;
    }

    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError(t("loginRequired"));
      setSaving(false);
      return;
    }

    const { error: predictionError } = await supabase.from("predictions").upsert(
      {
        user_id: user.id,
        race_id: raceId,
        athlete_ids: selected,
        bonus_x2_used: bonusX2,
        bonus_card_used: cardChoice === "none" ? null : cardChoice,
        bonus_card_target_athlete_id: cardChoice === "ca_farte" ? caFarteTarget : null,
      },
      { onConflict: "user_id,race_id" }
    );

    let failure = predictionError;

    if (!failure) {
      // Joue la carte si elle vient d'être choisie (la base vérifie la règle « une carte à la fois »).
      if (cardChoice !== "none" && cardChoice !== activeCard) {
        const card = playableCards.find((c) => c.card_type === cardChoice);
        if (card) {
          const { error: cardError } = await supabase.rpc("play_bonus_card", { p_card_id: card.id, p_race_id: raceId });
          failure = failure ?? cardError;
        }
      }
    }

    setSaving(false);
    if (failure) {
      console.error(failure);
      setError(t("saveError"));
    } else {
      setSavedState({
        key: [...selected].sort().join(","),
        bonusX2,
        card: cardChoice === "none" ? null : cardChoice,
        target: cardChoice === "ca_farte" ? caFarteTarget : null,
      });
      // La carte jouée devient « active » : l'encadré des cartes et le formulaire se mettent à jour.
      if (cardChoice !== "none" && cardChoice !== activeCard) router.refresh();
    }
  }

  // Ordre de départ : classés du sprint d'abord (1er en haut), puis les autres par cote.
  const sortedAthletes =
    sortBy === "start"
      ? [...athletes].sort((a, b) => (startOrder[a.athlete_id] ?? Infinity) - (startOrder[b.athlete_id] ?? Infinity) || a.value - b.value)
      : athletes;

  const athleteById = new Map(athletes.map((a) => [a.athlete_id, a]));
  // Pronostic enregistré et inchangé : « Ton pronostic est validé ! » remplace le bouton.
  const unsaved =
    savedState.key !== "" &&
    (savedState.key !== [...selected].sort().join(",") ||
      savedState.bonusX2 !== bonusX2 ||
      savedState.card !== (cardChoice === "none" ? null : cardChoice) ||
      (cardChoice === "ca_farte" && savedState.target !== caFarteTarget));
  const validated = savedState.key !== "" && !unsaved;

  return (
    <div className="flex flex-col gap-4">
      <PredictionSummary
        picks={selected.map((id) => {
          const a = athleteById.get(id);
          return { key: id, label: shortAthleteName(a), nationCode: a?.nation_code ?? "" };
        })}
        requiredCount={requiredCount}
        onRemove={toggle}
        x2Available={canUseX2}
        bonusX2={bonusX2}
        x2Remaining={x2UsesRemaining + (initialBonusX2 ? 1 : 0) - (bonusX2 ? 1 : 0)}
        onToggleX2={() => {
          setBonusX2((v) => !v);
        }}
        canSubmit={canSubmit}
        saving={saving}
        onSubmit={submit}
        unsaved={unsaved}
        success={validated ? t("saved") : null}
        error={error}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
            {requiredCount === 4 ? t("chooseFour") : t("chooseThree")}
          </div>
          <RuleInfoButton format={format} small />
        </div>
        {hasStartOrder && (
          <div className="flex rounded-full border border-border p-0.5">
            {(["start", "odds"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSortBy(mode)}
                className={`rounded-full px-2.5 py-1 font-display text-[11px] font-bold ${
                  sortBy === mode ? "bg-ice text-on-ice" : "text-text-dim"
                }`}
              >
                {mode === "start" ? t("sortByStart") : t("sortByOdds")}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {sortedAthletes.map((a) => {
          const isSelected = selected.includes(a.athlete_id);
          const isGrilled = grilledSet.has(a.athlete_id);
          const isCaFarteTarget = cardChoice === "ca_farte" && caFarteTarget === a.athlete_id;
          return (
            <button
              key={a.athlete_id}
              onClick={() => toggle(a.athlete_id)}
              disabled={isGrilled && !isSelected}
              className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-colors ${
                isGrilled && !isSelected
                  ? "border-border bg-card opacity-40"
                  : isCaFarteTarget
                    ? "border-gold bg-gold-soft"
                    : isSelected
                      ? "border-ice bg-ice-soft"
                      : "border-border bg-card"
              }`}
            >
              {sortBy === "start" && (
                <div className="w-6 flex-shrink-0 text-center font-display text-xs font-bold text-text-dim">
                  {startOrder[a.athlete_id] ?? "–"}
                </div>
              )}
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-semibold">
                  {a.first_name} {a.last_name}
                </span>
                <span className="text-[11px] text-text-dim">
                  {a.nation_code}
                  {/* Tri par cote d'une poursuite : la position de départ reste visible. */}
                  {sortBy === "odds" && startOrder[a.athlete_id] != null
                    ? ` · ${
                        startGaps[a.athlete_id] != null
                          ? t("startPositionWithGap", { position: startOrder[a.athlete_id], gap: startGaps[a.athlete_id] })
                          : t("startPosition", { position: startOrder[a.athlete_id] })
                      }`
                    : ""}
                  {isGrilled ? ` · ${t("grilled")}` : ""}
                </span>
              </div>
              {isSelected && cardChoice === "ca_farte" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCaFarteTarget(a.athlete_id);
                  }}
                  className={`whitespace-nowrap rounded-full px-2 py-1 font-display text-[11px] font-bold ${
                    isCaFarteTarget ? "bg-gold text-[#2a1900]" : "border border-border text-text-dim"
                  }`}
                >
                  ×3
                </button>
              )}
              {/* Poursuite : retard au départ, à gauche de la cote. */}
              {startGaps[a.athlete_id] != null && (
                <div className="font-display text-xs font-semibold tabular-nums text-text-dim">+{startGaps[a.athlete_id]}s</div>
              )}
              <div className={`font-display text-sm font-bold ${isSelected ? "text-ice" : "text-text-dim"}`}>
                ×{a.value}
              </div>
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] ${
                  isSelected ? "border-ice bg-ice" : "border-border"
                }`}
              >
                {isSelected && <CheckIcon className="h-3 w-3 text-on-ice" />}
              </div>
            </button>
          );
        })}
      </div>

      {activeCard ? (
        <div className="rounded-2xl border border-gold/40 bg-gold-soft p-3.5 text-[13px] leading-relaxed text-frost">
          <span className="font-display font-bold text-gold">
            🃏 {activeCard === "balle_de_pioche" ? t("cardBalleDePioche") : t("cardCaFarte")}
          </span>{" "}
          · {activeCard === "balle_de_pioche" ? t("quatriemeChoixActive") : t("caFarteActive")}
        </div>
      ) : (hasBalleDePioche || hasCaFarte) && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5">
          <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
            {t("cardSectionTitle")}
          </div>
          <div className="text-[12px] leading-relaxed text-text-dim">
            {cardChoice === "balle_de_pioche"
              ? t("quatriemeChoixHint")
              : cardChoice === "ca_farte"
                ? t("caFarteHint")
                : t("cardHint")}
          </div>
          <div className="flex flex-wrap gap-2">
            <CardOption label={t("noCard")} active={cardChoice === "none"} onClick={() => changeCard("none")} />
            {hasBalleDePioche && (
              <CardOption
                label={t("cardBalleDePioche")}
                active={cardChoice === "balle_de_pioche"}
                onClick={() => changeCard("balle_de_pioche")}
              />
            )}
            {hasCaFarte && (
              <CardOption
                label={t("cardCaFarte")}
                active={cardChoice === "ca_farte"}
                onClick={() => changeCard("ca_farte")}
              />
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function CardOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 font-display text-[12px] font-bold ${
        active ? "bg-ice text-on-ice" : "border border-border text-text-dim"
      }`}
    >
      {label}
    </button>
  );
}
