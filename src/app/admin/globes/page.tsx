import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { GlobeRankingForm, type CandidateOption } from "./GlobeRankingForm";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { category: "gros_globe_f", format: "gros_globe", sex: "F", isNation: false, title: "Gros Globe Femmes" },
  { category: "gros_globe_h", format: "gros_globe", sex: "H", isNation: false, title: "Gros Globe Hommes" },
  { category: "meilleur_jeune_f", format: "meilleur_jeune", sex: "F", isNation: false, title: "Meilleure jeune" },
  { category: "meilleur_jeune_h", format: "meilleur_jeune", sex: "H", isNation: false, title: "Meilleur jeune" },
  { category: "meilleure_nation_f", format: "meilleure_nation", sex: "F", isNation: true, title: "Meilleure nation Femmes" },
  { category: "meilleure_nation_h", format: "meilleure_nation", sex: "H", isNation: true, title: "Meilleure nation Hommes" },
] as const;

export default async function AdminGlobesPage() {
  const admin = createAdminClient();
  const { data: season } = await admin.from("seasons").select("id, label").eq("status", "active").maybeSingle();

  if (!season) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">Globes de saison</h1>
        <p className="text-sm text-text-dim">
          Aucune saison active. <Link href="/admin/seasons" className="underline">Active une saison</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Globes de saison — {season.label}</h1>
      <p className="text-sm text-text-dim">
        Saisis le classement final officiel (jusqu'à 5 rangs) de chaque catégorie pour noter les
        pronostics de saison des joueurs.
      </p>

      {await Promise.all(
        CATEGORIES.map(async (c) => {
          let options: CandidateOption[];

          if (c.isNation) {
            const { data: odds } = await admin
              .from("odds")
              .select("nation_code, value, nations(name)")
              .eq("season_id", season.id)
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
              .eq("season_id", season.id)
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

          return (
            <GlobeRankingForm key={c.category} seasonId={season.id} category={c.category} title={c.title} options={options} />
          );
        })
      )}
    </div>
  );
}
