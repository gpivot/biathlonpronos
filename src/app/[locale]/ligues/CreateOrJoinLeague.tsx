"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans caractères ambigus (0/O, 1/I...)
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function CreateOrJoinLeague({ seasonId }: { seasonId: string }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("Ligues");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError(t("loginRequired"));
      setLoading(false);
      return;
    }

    const { data: league, error: insertError } = await supabase
      .from("leagues")
      .insert({ season_id: seasonId, name, owner_id: user.id, invite_code: generateInviteCode() })
      .select("id")
      .single();

    if (insertError || !league) {
      setError(insertError?.message ?? t("createError"));
      setLoading(false);
      return;
    }

    await supabase.from("league_memberships").insert({ league_id: league.id, user_id: user.id });

    setLoading(false);
    router.push(`/ligues/${league.id}`);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError(t("loginRequired"));
      setLoading(false);
      return;
    }

    const { data: league, error: lookupError } = await supabase
      .from("leagues")
      .select("id")
      .eq("invite_code", code.trim().toUpperCase())
      .maybeSingle();

    if (lookupError || !league) {
      setError(t("joinError"));
      setLoading(false);
      return;
    }

    const { error: joinError } = await supabase
      .from("league_memberships")
      .insert({ league_id: league.id, user_id: user.id });

    setLoading(false);
    if (joinError) {
      setError(joinError.message);
      return;
    }
    router.push(`/ligues/${league.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleCreate} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
          {t("createTitle")}
        </div>
        <div className="flex gap-2">
          <input
            required
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-ice"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-ice px-4 py-2 font-display text-sm font-bold text-[#062024] disabled:opacity-60"
          >
            {t("createButton")}
          </button>
        </div>
      </form>

      <form onSubmit={handleJoin} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
          {t("joinTitle")}
        </div>
        <div className="flex gap-2">
          <input
            required
            placeholder={t("codePlaceholder")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm uppercase outline-none focus:border-ice"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl border border-border px-4 py-2 font-display text-sm font-bold disabled:opacity-60"
          >
            {t("joinButton")}
          </button>
        </div>
      </form>

      {error && <div className="text-xs text-red">{error}</div>}
    </div>
  );
}
