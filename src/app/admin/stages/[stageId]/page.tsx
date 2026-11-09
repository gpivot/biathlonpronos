import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { nationFlagEmoji } from "@/lib/nationFlags";
import { updateStage } from "../../calendrier/actions";
import { STAGE_CATEGORY_OPTIONS, stageCategoryFormValue } from "@/lib/stageCategory";

const inputClass = "rounded border border-border bg-bg px-2 py-1.5 text-sm";

export const dynamic = "force-dynamic";

/** Modification des infos d'une étape (lieu, pays, dates, coefficient). */
export default async function AdminStagePage({ params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params;
  const admin = createAdminClient();

  const [{ data: stage }, { data: nations }] = await Promise.all([
    admin.from("stages").select("*, races(id, status)").eq("id", stageId).single(),
    admin.from("nations").select("*").order("name"),
  ]);
  if (!stage) notFound();

  const hasFinishedRace = ((stage.races ?? []) as { status: string }[]).some((r) => r.status === "finished");

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin" className="text-sm text-text-dim underline">
        Retour au calendrier
      </Link>
      <h1 className="text-xl font-bold">
        {nationFlagEmoji(stage.country_code)} {stage.location}
      </h1>

      <form action={updateStage} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Infos de l&apos;étape</div>
        <input type="hidden" name="stage_id" value={stage.id} />
        <div className="flex flex-wrap gap-2">
          <input
            name="location"
            required
            defaultValue={stage.location}
            placeholder="Lieu (ex. Kontiolahti)"
            className={inputClass}
          />
          <select name="country_code" required defaultValue={stage.country_code} className={inputClass}>
            {(nations ?? []).map((n) => (
              <option key={n.code} value={n.code}>
                {n.name} ({n.code})
              </option>
            ))}
          </select>
          <input name="starts_on" type="date" required defaultValue={stage.starts_on} title="Début" className={inputClass} />
          <input name="ends_on" type="date" required defaultValue={stage.ends_on} title="Fin" className={inputClass} />
          <select name="coefficient" defaultValue={stageCategoryFormValue(stage)} className={inputClass}>
            {STAGE_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            name="label"
            maxLength={40}
            defaultValue={stage.label ?? ""}
            placeholder="Mention (ex. Pré-saison)"
            title="Texte affiché au-dessus du lieu dans le Calendrier. Vide : Coupe du Monde / Championnats du monde, rien pour une étape hors classement."
            className={inputClass}
          />
          <label className="flex items-center gap-1.5 text-xs text-text-dim">
            Ouverture des pronos le
            <input
              name="predictions_open_on"
              type="date"
              defaultValue={stage.predictions_open_on ?? ""}
              title="À 17 h, heure de Paris. Vide : le lundi qui précède l'étape."
              className={inputClass}
            />
            à 17 h
          </label>
          <button type="submit" className="rounded bg-ice px-4 py-1.5 text-sm font-bold text-on-ice">
            Enregistrer
          </button>
        </div>
        <p className="text-xs text-text-dim">
          Ouverture des pronos : vide = le lundi qui précède l&apos;étape à 17 h ; une date = ce jour-là à
          17 h (une date passée ouvre tout de suite). Les horaires des courses se modifient avec le crayon de chaque course. « Autre (×0) » : courses
          tests ou de recrutement, notées normalement mais hors classement de la saison (pas de dossard
          rouge, de carte bonus, de ×2, de Pépite ni de série 10/10).
          {hasFinishedRace &&
            " Attention : des courses de cette étape sont déjà notées ; un passage ×1 / ×2 ne recalcule pas leurs points tant que leurs résultats ne sont pas réenregistrés (le passage en ×0 ou hors de ×0 s’applique tout de suite au classement)."}
        </p>
      </form>
    </div>
  );
}
