"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { CheckIcon } from "@/components/icons";
import { SaveFeedback } from "./SaveFeedback";

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
  athletes,
  initialSelection,
  grilledAthleteIds,
  availableCards,
  initialBonusX2,
  initialCardUsed,
  initialCardTarget,
  x2Eligible,
  x2UsesRemaining,
}: {
  raceId: string;
  athletes: AthleteWithOdds[];
  initialSelection: string[];
  grilledAthleteIds: string[];
  availableCards: { id: string; card_type: string }[];
  initialBonusX2: boolean;
  initialCardUsed: string | null;
  initialCardTarget: string | null;
  x2Eligible: boolean;
  x2UsesRemaining: number;
}) {
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const [cardChoice, setCardChoice] = useState<CardChoice>(
    initialCardUsed === "balle_de_pioche" || initialCardUsed === "ca_farte" ? initialCardUsed : "none"
  );
  const [caFarteTarget, setCaFarteTarget] = useState<string | null>(initialCardTarget);
  const [bonusX2, setBonusX2] = useState(initialBonusX2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Encart « pronostic validé », masqué dès que le joueur modifie son choix.
  const [saved, setSaved] = useState(false);
  const supabase = createClient();
  const t = useTranslations("PredictionForm");

  const grilledSet = new Set(grilledAthleteIds);
  const hasBalleDePioche = availableCards.some((c) => c.card_type === "balle_de_pioche");
  const hasCaFarte = availableCards.some((c) => c.card_type === "ca_farte");
  const canUseX2 = x2Eligible && (initialBonusX2 || x2UsesRemaining > 0);
  const requiredCount = cardChoice === "balle_de_pioche" ? 4 : 3;

  function toggle(athleteId: string) {
    setSaved(false);
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
    setSaved(false);
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
    setSaved(false);

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
      // Consomme la carte si elle vient d'être appliquée (pas déjà utilisée
      // lors d'un enregistrement précédent de ce même pronostic).
      if (cardChoice !== "none" && cardChoice !== initialCardUsed) {
        const card = availableCards.find((c) => c.card_type === cardChoice);
        if (card) {
          const { error: cardError } = await supabase
            .from("bonus_cards")
            .update({ status: "used", used_at: new Date().toISOString(), used_on_race_id: raceId })
            .eq("id", card.id);
          failure = failure ?? cardError;
        }
      }
    }

    setSaving(false);
    if (failure) {
      console.error(failure);
      setError(t("saveError"));
    } else {
      setSaved(true);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
          {t("chooseThree")}
        </div>
        <div className="font-display text-sm font-bold text-ice">
          {selected.length} / {requiredCount}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {athletes.map((a) => {
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
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-semibold">
                  {a.first_name} {a.last_name}
                </span>
                <span className="text-[11px] text-text-dim">
                  {a.nation_code}
                  {isGrilled ? ` · ${t("grilled")}` : ""}
                </span>
              </div>
              {isSelected && cardChoice === "ca_farte" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCaFarteTarget(a.athlete_id);
                    setSaved(false);
                  }}
                  className={`whitespace-nowrap rounded-full px-2 py-1 font-display text-[11px] font-bold ${
                    isCaFarteTarget ? "bg-gold text-[#2a1900]" : "border border-border text-text-dim"
                  }`}
                >
                  ×3
                </button>
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

      {(hasBalleDePioche || hasCaFarte) && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5">
          <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
            {t("cardSectionTitle")}
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

      {canUseX2 && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bonusX2} onChange={(e) => {
              setBonusX2(e.target.checked);
              setSaved(false);
            }} />
          {t("bonusX2Label", { count: x2UsesRemaining })}
        </label>
      )}

      <button
        onClick={submit}
        disabled={selected.length !== requiredCount || saving}
        className="rounded-2xl bg-ice py-3.5 text-center font-display text-[15px] font-bold text-on-ice disabled:opacity-40"
      >
        {saving ? t("saving") : t("submit")}
      </button>

      <SaveFeedback success={saved ? t("saved") : null} error={error} />
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
