import { fullAthleteName } from "@/lib/athleteName";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlobesForm, type GlobeCategoryConfig } from "./GlobesForm";
import { PepiteForm } from "./PepiteForm";
import { getClock } from "@/lib/clock";
import { isPepiteEligibleOdds } from "@/lib/scoring";
import { fetchAll } from "@/lib/admin/fetchAll";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { category: "gros_globe_f", format: "gros_globe", sex: "F", isNation: false },
  { category: "gros_globe_h", format: "gros_globe", sex: "H", isNation: false },
  { category: "meilleur_jeune_f", format: "meilleur_jeune", sex: "F", isNation: false },
  { category: "meilleur_jeune_h", format: "meilleur_jeune", sex: "H", isNation: false },
  { category: "meilleure_nation_f", format: "meilleure_nation", sex: "F", isNation: true },
  { category: "meilleure_nation_h", format: "meilleure_nation", sex: "H", isNation: true },
] as const;

/** Choix des pronostics de saison : favoris d'abord (cote croissante), puis par nom à cote égale. */
function byOddsThenLabel(a: { odds: number; label: string }, b: { odds: number; label: string }) {
  return Number(a.odds) - Number(b.odds) || a.label.localeCompare(b.label);
}

export default async function GlobesPage() {
  const supabase = createClient();
  const t = await getTranslations("Globes");

  const { data: season } = await supabase.from("seasons").select("*").eq("status", "active").maybeSingle();

  if (!season) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-6">
        <BackLink />
        <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
          {t("noSeason")}
        </div>
      </div>
    );
  }

  const { now } = await getClock();
  const isLocked = new Date(season.starts_on) <= now;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-6">
        <BackLink />
        <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
          {t("loginRequired")}
        </div>
      </div>
    );
  }

  const [{ data: existingPicks }, { data: nations }, { data: pepites }, pepiteOdds] = await Promise.all([
    supabase
      .from("season_predictions")
      .select("category, athlete_id, nation_code")
      .eq("user_id", user.id)
      .eq("season_id", season.id),
    supabase.from("nations").select("code, name"),
    supabase.from("pepites").select("sex, athlete_id, bonus_claimed").eq("user_id", user.id).eq("season_id", season.id),
    // Toutes les cotes courantes des biathlètes (plus de 1000 lignes) : une Pépite doit avoir chacune ≥ 30.
    fetchAll<any>((from, to) =>
      supabase
        .from("odds")
        .select("id, athlete_id, value, athletes(first_name, last_name, nation_code, sex)")
        .eq("season_id", season.id)
        .not("athlete_id", "is", null)
        .is("valid_until", null)
        .order("id")
        .range(from, to)
    ),
  ]);
  const nameByNationCode = new Map((nations ?? []).map((n) => [n.code, n.name]));
  const pepiteBySex = new Map((pepites ?? []).map((p) => [p.sex, p]));
  const oddsByAthlete = new Map<string, { athlete: any; values: number[] }>();
  for (const o of pepiteOdds) {
    const entry = oddsByAthlete.get(o.athlete_id) ?? { athlete: o.athletes, values: [] };
    entry.values.push(Number(o.value));
    oddsByAthlete.set(o.athlete_id, entry);
  }
  // Libellé : la plus basse de ses cotes (toutes ≥ 30).
  const pepiteOptionsFor = (sex: "H" | "F") =>
    Array.from(oddsByAthlete.entries())
      .filter(([, e]) => e.athlete?.sex === sex && isPepiteEligibleOdds(e.values))
      .map(([id, e]) => {
        const odds = Math.min(...e.values);
        return { id, label: `${fullAthleteName(e.athlete)} (${e.athlete.nation_code}) — ×${odds}`, odds };
      })
      .sort(byOddsThenLabel);
  const pickByCategory = new Map((existingPicks ?? []).map((p) => [p.category, p]));

  const categories: GlobeCategoryConfig[] = [];
  for (const c of CATEGORIES) {
    const existing = pickByCategory.get(c.category);

    if (c.isNation) {
      const { data: odds } = await supabase
        .from("odds")
        .select("nation_code, value")
        .eq("season_id", season.id)
        .eq("format", c.format)
        .eq("nation_sex", c.sex)
        .is("valid_until", null);

      categories.push({
        category: c.category,
        isNation: true,
        initialPick: existing?.nation_code ?? null,
        options: (odds ?? [])
          .map((o) => ({ id: o.nation_code as string, label: `${nameByNationCode.get(o.nation_code!) ?? o.nation_code} — ×${o.value}`, odds: Number(o.value) }))
          .sort(byOddsThenLabel),
      });
    } else {
      const { data: odds } = await supabase
        .from("odds")
        .select("athlete_id, value, athletes(first_name, last_name, nation_code, sex)")
        .eq("season_id", season.id)
        .eq("format", c.format)
        .is("valid_until", null);

      categories.push({
        category: c.category,
        isNation: false,
        initialPick: existing?.athlete_id ?? null,
        options: (odds ?? [])
          .filter((o: any) => o.athletes?.sex === c.sex)
          .map((o: any) => ({
            id: o.athlete_id,
            label: `${fullAthleteName(o.athletes)} (${o.athletes.nation_code}) — ×${o.value}`,
            odds: Number(o.value),
          }))
          .sort(byOddsThenLabel),
      });
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pb-8 pt-6">
      <BackLink />
      <div className="flex flex-col gap-1">
        <div className="font-display text-lg font-bold">{t("title")}</div>
        <p className="text-[13px] leading-relaxed text-text-dim">{t("intro")}</p>
      </div>

      {isLocked ? (
        <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-text-dim">
          {t("lockedMessage")}
        </div>
      ) : (
        <GlobesForm seasonId={season.id} categories={categories} />
      )}

      <div className="flex flex-col gap-3">
        <PepiteForm
          sex="F"
          seasonId={season.id}
          initialPick={pepiteBySex.get("F")?.athlete_id ?? null}
          alreadyClaimed={pepiteBySex.get("F")?.bonus_claimed ?? false}
          options={pepiteOptionsFor("F")}
        />
        <PepiteForm
          sex="H"
          seasonId={season.id}
          initialPick={pepiteBySex.get("H")?.athlete_id ?? null}
          alreadyClaimed={pepiteBySex.get("H")?.bonus_claimed ?? false}
          options={pepiteOptionsFor("H")}
        />
      </div>
    </div>
  );
}

async function BackLink() {
  const t = await getTranslations("Globes");
  return (
    <Link href="/courses" className="text-xs text-text-dim underline">
      {t("back")}
    </Link>
  );
}
