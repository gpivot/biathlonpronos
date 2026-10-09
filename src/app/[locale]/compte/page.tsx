import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { FavoriteTeamForm } from "./FavoriteTeamForm";
import { SignOutButton } from "./SignOutButton";
import { ClaimCardPicker } from "./ClaimCardPicker";

export const dynamic = "force-dynamic";

export default async function ComptePage() {
  const supabase = createClient();
  const t = await getTranslations("Compte");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-6">
        <BackLink />
        <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
          {t("loginRequired")}
        </div>
      </div>
    );
  }

  const [{ data: profile }, { data: season }, { data: nations }] = await Promise.all([
    supabase.from("profiles").select("pseudo").eq("id", user.id).single(),
    supabase.from("seasons").select("id").eq("status", "active").maybeSingle(),
    supabase.from("nations").select("code, name").order("name"),
  ]);

  let favoriteTeam: { nation_code: string; sex: "H" | "F" } | null = null;
  let availableCards: { card_type: string }[] = [];
  let unclaimedCount = 0;
  if (season) {
    const [{ data: favorite }, { data: cards }, { data: streak }, { count: claimedCount }] = await Promise.all([
      supabase
        .from("favorite_teams")
        .select("nation_code, sex")
        .eq("user_id", user.id)
        .eq("season_id", season.id)
        .maybeSingle(),
      supabase
        .from("bonus_cards")
        .select("card_type")
        .eq("user_id", user.id)
        .eq("season_id", season.id)
        .eq("status", "available"),
      supabase
        .from("streak_counters")
        .select("cards_earned")
        .eq("user_id", user.id)
        .eq("season_id", season.id)
        .maybeSingle(),
      supabase
        .from("bonus_cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("season_id", season.id),
    ]);
    favoriteTeam = favorite ?? null;
    availableCards = cards ?? [];
    unclaimedCount = Math.max(0, (streak?.cards_earned ?? 0) - (claimedCount ?? 0));
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pb-8 pt-6">
      <BackLink />

      <div className="flex flex-col gap-1">
        <div className="font-display text-lg font-bold">{profile?.pseudo}</div>
        <div className="text-xs text-text-dim">{user.email}</div>
      </div>

      {season && (nations ?? []).length > 0 && (
        <FavoriteTeamForm
          seasonId={season.id}
          nations={nations!}
          initialNationCode={favoriteTeam?.nation_code ?? null}
          initialSex={favoriteTeam?.sex ?? null}
        />
      )}

      {season && unclaimedCount > 0 && (
        <ClaimCardPicker
          seasonId={season.id}
          unclaimedCount={unclaimedCount}
          heldAvailableTypes={availableCards.map((c) => c.card_type)}
        />
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <div className="font-display text-xs font-bold uppercase tracking-wider text-text-dim">
          {t("bonusCardsTitle")}
        </div>
        {availableCards.length === 0 ? (
          <p className="text-[12px] text-text-dim">{t("bonusCardsEmpty")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableCards.map((c, i) => (
              <span
                key={i}
                className="rounded-full bg-gold-soft px-3 py-1 font-display text-[12px] font-bold text-gold"
              >
                {t(`cardLabel_${c.card_type}`)}
              </span>
            ))}
          </div>
        )}
      </div>

      <SignOutButton />
    </div>
  );
}

async function BackLink() {
  const t = await getTranslations("Compte");
  return (
    <Link href="/" className="text-xs text-text-dim underline">
      {t("back")}
    </Link>
  );
}
