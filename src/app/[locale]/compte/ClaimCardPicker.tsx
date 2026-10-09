"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const CARD_TYPES = ["balle_de_pioche", "ca_farte", "fondue", "chat_noir"] as const;

export function ClaimCardPicker({
  seasonId,
  unclaimedCount,
  heldAvailableTypes,
}: {
  seasonId: string;
  unclaimedCount: number;
  heldAvailableTypes: string[];
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("Compte");

  const heldSet = new Set(heldAvailableTypes);

  async function claim(cardType: string) {
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("bonus_cards")
      .insert({ user_id: user.id, season_id: seasonId, card_type: cardType, status: "available" });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-gold/40 bg-gold-soft p-4">
      <div className="font-display text-sm font-bold text-gold">{t("claimCardTitle", { count: unclaimedCount })}</div>
      <div className="flex flex-wrap gap-2">
        {CARD_TYPES.map((cardType) => {
          const disabled = saving || heldSet.has(cardType);
          return (
            <button
              key={cardType}
              onClick={() => claim(cardType)}
              disabled={disabled}
              className={`rounded-full px-3 py-1.5 font-display text-[12px] font-bold ${
                disabled ? "border border-border text-text-dim opacity-50" : "bg-gold text-[#2a1900]"
              }`}
            >
              {t(`cardLabel_${cardType}`)}
            </button>
          );
        })}
      </div>
      {error && <div className="text-xs text-red">{error}</div>}
    </div>
  );
}
