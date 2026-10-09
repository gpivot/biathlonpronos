"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function FondueButton({ stageId, cardId }: { stageId: string; cardId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("PredictionForm");

  async function handleClick() {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: deleteError } = await supabase
      .from("grilled_states")
      .delete()
      .eq("user_id", user.id)
      .eq("stage_id", stageId);

    if (deleteError) {
      setError(deleteError.message);
      setLoading(false);
      return;
    }

    const { error: cardError } = await supabase
      .from("bonus_cards")
      .update({ status: "used", used_at: new Date().toISOString() })
      .eq("id", cardId);

    setLoading(false);
    if (cardError) {
      setError(cardError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={handleClick}
        disabled={loading}
        className="self-start rounded-full border border-gold/40 bg-gold-soft px-3.5 py-1.5 font-display text-[12px] font-bold text-gold disabled:opacity-60"
      >
        {loading ? t("saving") : t("cardFondueAction")}
      </button>
      {error && <div className="text-xs text-red">{error}</div>}
    </div>
  );
}
