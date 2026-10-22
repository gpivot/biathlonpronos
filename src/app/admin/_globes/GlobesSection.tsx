import type { SupabaseClient } from "@supabase/supabase-js";
import { GlobeRankingForm, type CandidateOption } from "./GlobeRankingForm";

const CATEGORIES = [
  { category: "gros_globe_f", format: "gros_globe", sex: "F", isNation: false, title: "Gros Globe Femmes" },
  { category: "gros_globe_h", format: "gros_globe", sex: "H", isNation: false, title: "Gros Globe Hommes" },
  { category: "meilleur_jeune_f", format: "meilleur_jeune", sex: "F", isNation: false, title: "Meilleure jeune" },
  { category: "meilleur_jeune_h", format: "meilleur_jeune", sex: "H", isNation: false, title: "Meilleur jeune" },
  { category: "meilleure_nation_f", format: "meilleure_nation", sex: "F", isNation: true, title: "Meilleure nation Femmes" },
  { category: "meilleure_nation_h", format: "meilleure_nation", sex: "H", isNation: true, title: "Meilleure nation Hommes" },
] as const;

/** Classement final officiel de chaque catégorie de pronostic de saison (jusqu'à 5 rangs). */
export async function GlobesSection({ admin, seasonId }: { admin: SupabaseClient; seasonId: string }) {
  const forms = await Promise.all(
    CATEGORIES.map(async (c) => {
      let options: CandidateOption[];

      if (c.isNation) {
        const { data: odds } = await admin
          .from("odds")
          .select("nation_code, value, nations(name)")
          .eq("season_id", seasonId)
          .eq("format", c.format)
          .eq("nation_sex", c.sex)
          .is("valid_until", null);
        options = (odds ?? [])
          .map((o: any) => ({ id: o.nation_code, label: `${o.nations?.name ?? o.nation_code} (×${o.value})` }))
          .sort((a, b) => a.label.localeCompare(b.label));
      } else {
        const { data: odds } = await admin
          .from("odds")
          .select("athlete_id, value, athletes(first_name, last_name, nation_code, sex)")
          .eq("season_id", seasonId)
          .eq("format", c.format)
          .is("valid_until", null);
        options = (odds ?? [])
          .filter((o: any) => o.athletes?.sex === c.sex)
          .map((o: any) => ({
            id: o.athlete_id,
            label: `${o.athletes.first_name} ${o.athletes.last_name} (${o.athletes.nation_code}, ×${o.value})`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
      }

      return <GlobeRankingForm key={c.category} seasonId={seasonId} category={c.category} title={c.title} options={options} />;
    })
  );

  return <div className="flex flex-col gap-3">{forms}</div>;
}
