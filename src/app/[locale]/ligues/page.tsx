import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { CreateOrJoinLeague } from "./CreateOrJoinLeague";

export const dynamic = "force-dynamic";

export default async function LiguesPage() {
  const supabase = createClient();
  const t = await getTranslations("Ligues");

  const { data: season } = await supabase.from("seasons").select("id").eq("status", "active").maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myLeagues: { id: string; name: string }[] = [];
  if (user) {
    const { data: memberships } = await supabase
      .from("league_memberships")
      .select("leagues(id, name)")
      .eq("user_id", user.id);
    myLeagues = (memberships ?? []).map((m: any) => m.leagues).filter(Boolean);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-auto px-5 pb-3 pt-6">
        <div className="font-display text-lg font-bold">{t("title")}</div>

        {!user ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
            {t("loginRequired")}
          </div>
        ) : (
          <>
            {myLeagues.length > 0 && (
              <div className="flex flex-col gap-2">
                {myLeagues.map((league) => (
                  <Link
                    key={league.id}
                    href={`/ligues/${league.id}`}
                    className="flex items-center rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-semibold"
                  >
                    {league.name}
                  </Link>
                ))}
              </div>
            )}

            {season && <CreateOrJoinLeague seasonId={season.id} />}
          </>
        )}
      </div>

      <BottomNav active="/ligues" />
    </div>
  );
}
