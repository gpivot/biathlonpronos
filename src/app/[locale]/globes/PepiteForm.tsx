"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { GlobeOption } from "./GlobesForm";
import { ChoicePicker } from "@/components/ChoicePicker";

export function PepiteForm({
  sex,
  seasonId,
  options,
  initialPick,
  alreadyClaimed,
  talentCardId = null,
  revealedName = null,
  fromTalent = false,
  editable = false,
  editDeadline = null,
  autoOpen = false,
}: {
  sex: "H" | "F";
  seasonId: string;
  options: (GlobeOption & { odds: number })[];
  initialPick: string | null;
  alreadyClaimed: boolean;
  /** Carte Talent en main : une pépite révélée peut être réactivée ou remplacée. */
  talentCardId?: string | null;
  revealedName?: string | null;
  /** Pépite choisie ou réactivée avec la carte Talent. */
  fromTalent?: boolean;
  /** Modifiable jusqu'au départ de la 1re course de Coupe du Monde (migration 0046). */
  editable?: boolean;
  /** Date et heure de ce départ, déjà formatées (null si pas encore au calendrier). */
  editDeadline?: string | null;
  /** Liste ouverte d'office (arrivée depuis l'encadré « Pépite cachée » du Calendrier). */
  autoOpen?: boolean;
}) {
  // Pépite choisie avant la règle « toutes les cotes ≥ 30 » et plus éligible : le choix se rouvre.
  // (Une pépite choisie avec la carte Talent reste définitive.)
  const noLongerEligible = !!initialPick && !alreadyClaimed && !fromTalent && !options.some((o) => o.id === initialPick);
  // Sinon, modifiable jusqu'au départ de la 1re course de Coupe du Monde, puis verrouillée.
  const locked = !!initialPick && !noLongerEligible && (!editable || fromTalent);
  const [savedPick, setSavedPick] = useState(noLongerEligible ? null : initialPick);
  const [pick, setPick] = useState(noLongerEligible ? "" : initialPick ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();
  const t = useTranslations("Globes");
  const tCompte = useTranslations("Compte");
  const tForm = useTranslations("PredictionForm");
  const router = useRouter();
  const deadlineHint =
    alreadyClaimed || noLongerEligible || fromTalent
      ? null
      : editable
        ? editDeadline
          ? t("pepiteEditableUntil", { date: editDeadline })
          : t("pepiteEditableNoDate")
        : initialPick
          ? t("pepiteLocked")
          : null;

  // Le choix s'enregistre dès qu'il est fait dans la liste (24/11/2026).
  async function submit(pick: string) {
    if (!pick || pick === savedPick) return;
    setPick(pick);
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

    const oddsAtPick = options.find((o) => o.id === pick)?.odds ?? 0;

    const { error } = await supabase
      .from("pepites")
      .upsert(
        { user_id: user.id, season_id: seasonId, sex, athlete_id: pick, odds_at_pick: oddsAtPick },
        { onConflict: "user_id,season_id,sex" }
      );

    setSaving(false);
    if (error) {
      setPick(savedPick ?? "");
      const message = error.message ?? "";
      setError(
        message.includes("pepite_not_eligible")
          ? t("pepiteNotEligible")
          : message.includes("pepite_in_upcoming_prediction")
            ? t("talentInPrediction")
            : message.includes("pepite_definitive")
              ? t("pepiteLocked")
              : message
      );
      return;
    }
    setSavedPick(pick);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
        ❄️ {t("pepiteTitle")} — {sex === "F" ? tCompte("women") : tCompte("men")}
      </div>
      <p className="text-[12px] leading-relaxed text-text-dim">{t("pepiteHint")}</p>
      {noLongerEligible && <p className="text-[12px] leading-relaxed text-gold">{t("pepiteNoLongerEligible")}</p>}
      {deadlineHint && <p className="text-[12px] leading-relaxed text-text-dim">{deadlineHint}</p>}

      {alreadyClaimed ? (
        <>
          <p className="text-[13px] text-ice">{t("pepiteClaimed")}</p>
          {talentCardId && initialPick && (
            <TalentCardForm
              sex={sex}
              cardId={talentCardId}
              revealedId={initialPick}
              revealedName={revealedName ?? ""}
              options={options}
            />
          )}
        </>
      ) : (
        <>
          <ChoicePicker
            title={`${t("pepiteTitle")} — ${sex === "F" ? tCompte("women") : tCompte("men")}`}
            icon={<span className="text-xl leading-none">❄️</span>}
            options={options}
            value={pick}
            onChange={submit}
            searchPlaceholder={tForm("searchAthlete")}
            disabled={locked || saving}
            defaultOpen={autoOpen && !locked}
            onCard
          />

          {saving && <div className="text-xs text-text-dim">{t("saving")}</div>}
          {error && <div className="text-xs text-red">{error}</div>}
          {saved && !error && <div className="text-xs text-ice">✓ {t("pepiteSaved")}</div>}
        </>
      )}
    </div>
  );
}

/**
 * Carte Talent (04/11/2026) : réactiver la pépite révélée (elle redevient cachée et marque à son
 * prochain Top 10) ou en choisir une nouvelle (toutes ses cotes ≥ 30). Effet pour les courses
 * suivantes ; refusé si le biathlète est dans un pronostic de course pas encore partie.
 */
function TalentCardForm({
  sex,
  cardId,
  revealedId,
  revealedName,
  options,
}: {
  sex: "H" | "F";
  cardId: string;
  revealedId: string;
  revealedName: string;
  options: (GlobeOption & { odds: number })[];
}) {
  const t = useTranslations("Globes");
  const tForm = useTranslations("PredictionForm");
  const router = useRouter();
  const [mode, setMode] = useState<"reactivate" | "new">("reactivate");
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const athleteId = mode === "reactivate" ? revealedId : pick;
    if (!athleteId) return;
    setSaving(true);
    setError(null);
    const { error: playError } = await createClient().rpc("play_talent_card", {
      p_card_id: cardId,
      p_sex: sex,
      p_athlete_id: athleteId,
    });
    setSaving(false);
    if (playError) {
      const message = playError.message ?? "";
      setError(
        message.includes("pepite_in_upcoming_prediction")
          ? t("talentInPrediction")
          : message.includes("pepite_not_eligible")
            ? t("pepiteNotEligible")
            : t("talentError")
      );
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gold/60 bg-gold-soft p-3">
      <div className="font-display text-[13px] font-extrabold text-gold">🃏 {t("talentTitle")}</div>
      <p className="text-[12px] leading-relaxed text-text-dim">{t("talentHint")}</p>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="radio" checked={mode === "reactivate"} onChange={() => setMode("reactivate")} />
        {t("talentReactivate", { name: revealedName })}
      </label>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />
        {t("talentNew")}
      </label>
      {mode === "new" && (
        <ChoicePicker
          title={t("talentNew")}
          icon={<span className="text-xl leading-none">🃏</span>}
          options={options.filter((o) => o.id !== revealedId)}
          value={pick}
          onChange={setPick}
          searchPlaceholder={tForm("searchAthlete")}
          onCard
        />
      )}
      {error && <div className="text-xs text-red">{error}</div>}
      <button
        onClick={submit}
        disabled={saving || (mode === "new" && !pick)}
        className="self-start rounded-xl bg-gold px-4 py-2 font-display text-sm font-bold text-on-gold disabled:opacity-40"
      >
        {saving ? t("saving") : t("talentSubmit")}
      </button>
    </div>
  );
}
