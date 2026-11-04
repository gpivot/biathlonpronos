"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { DISPLAY_TIME_ZONE } from "@/lib/displayTimeZone";
import type { PlayerCards } from "@/lib/bonusCards";

/**
 * Cartes en main à jouer hors d'une course : Fusée / Gâchette à poser sur une étape pas encore
 * commencée (play_stage_card), Talent à jouer depuis la page des pronostics de saison.
 * Encadré « Série en cours » du joueur connecté.
 */
export function StageCardPlayer({
  stagePlays,
  talentCardId,
}: {
  stagePlays: NonNullable<PlayerCards["stagePlays"]>;
  talentCardId: string | null;
}) {
  const t = useTranslations("BonusCards");
  if (stagePlays.length === 0 && !talentCardId) return null;
  return (
    <div className="flex flex-col gap-2">
      {stagePlays.map((play) => (
        <StagePlay key={play.cardId} play={play} />
      ))}
      {talentCardId && (
        <Link
          href="/globes"
          className="flex items-center gap-2 rounded-xl border border-gold/60 bg-gold-soft px-3 py-2 text-[12px] font-semibold text-gold"
        >
          <span>🃏</span>
          <span className="flex-1">{t("talentPlayHint")}</span>
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}

function StagePlay({ play }: { play: NonNullable<PlayerCards["stagePlays"]>[number] }) {
  const t = useTranslations("BonusCards");
  const locale = useLocale();
  const router = useRouter();
  const [stageId, setStageId] = useState(play.stages[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!stageId) return;
    setSaving(true);
    setError(null);
    const { error: playError } = await createClient().rpc("play_stage_card", { p_card_id: play.cardId, p_stage_id: stageId });
    setSaving(false);
    if (playError) {
      console.error(playError);
      setError(t("stagePlayError"));
      return;
    }
    router.refresh();
  }

  const day = (date: string) =>
    new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString(locale, { timeZone: DISPLAY_TIME_ZONE, day: "numeric", month: "short" });

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gold/60 bg-gold-soft px-3 py-2.5">
      <div className="text-[12px] font-semibold text-gold">
        🃏 {t(`name_${play.type}`)} · {t("stagePlayTitle")}
      </div>
      {play.stages.length === 0 ? (
        <div className="text-[12px] text-text-dim">{t("stagePlayNone")}</div>
      ) : (
        <div className="flex gap-2">
          <select
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-[13px]"
          >
            {play.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.location} · {day(s.startsOn)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !stageId}
            className="rounded-full bg-gold px-3 py-1.5 font-display text-[12px] font-extrabold text-on-gold disabled:opacity-50"
          >
            {t("stagePlayButton")}
          </button>
        </div>
      )}
      {error && <div className="text-xs text-red">{error}</div>}
    </div>
  );
}
