"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { sendPush } from "@/lib/push/send";
import {
  BONUS_QUESTION_POINTS,
  LIVE_QUESTION_MAX_MINUTES,
  bonusQuestionLedgerRows,
  bonusQuestionState,
  cleanOptions,
  type BonusQuestionKind,
} from "@/lib/bonusQuestions";

export type BonusQuestionActionResult = { ok: true; message: string } | { ok: false; message: string };

function fail(error: unknown): BonusQuestionActionResult {
  return { ok: false, message: error instanceof Error ? error.message : "Erreur inconnue." };
}

function revalidate(raceId: string) {
  revalidatePath(`/admin/races/${raceId}`);
  revalidatePath("/", "layout");
}

/** Nouvelle question : publiée tout de suite (avant le départ) ou en brouillon (live, à lancer). */
export async function createBonusQuestion(input: {
  raceId: string;
  kind: BonusQuestionKind;
  question: string;
  options: string[];
}): Promise<BonusQuestionActionResult> {
  try {
    await requireAdmin();
    if (input.kind !== "pre_race" && input.kind !== "live") return { ok: false, message: "Type de question inconnu." };
    const question = input.question.trim();
    if (!question || question.length > 300) return { ok: false, message: "Question obligatoire (300 caractères au plus)." };
    const options = cleanOptions(input.options, input.kind);
    if (!options) {
      return {
        ok: false,
        message:
          input.kind === "live"
            ? "Une question live a exactement 2 réponses (80 caractères au plus)."
            : "Il faut 2 à 4 réponses (80 caractères au plus).",
      };
    }
    const { error } = await createAdminClient()
      .from("bonus_questions")
      .insert({ race_id: input.raceId, kind: input.kind, question, options });
    if (error) throw new Error(error.message);
    revalidate(input.raceId);
    return {
      ok: true,
      message: input.kind === "live" ? "Question live enregistrée. Lance-la pendant la course." : "Question publiée sur la page de la course.",
    };
  } catch (error) {
    return fail(error);
  }
}

/** Lance une question live : ouverte `minutes` minutes à partir de maintenant, notification à tous. */
export async function launchLiveQuestion(questionId: string, minutes: number): Promise<BonusQuestionActionResult> {
  try {
    await requireAdmin();
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > LIVE_QUESTION_MAX_MINUTES) {
      return { ok: false, message: `Durée entre 1 et ${LIVE_QUESTION_MAX_MINUTES} minutes.` };
    }
    const admin = createAdminClient();
    const { data: question, error: readError } = await admin
      .from("bonus_questions")
      .select("id, race_id, kind, question, opens_at")
      .eq("id", questionId)
      .single();
    if (readError || !question) throw new Error(readError?.message ?? "Question introuvable.");
    if (question.kind !== "live") return { ok: false, message: "Seule une question live se lance." };
    if (question.opens_at) return { ok: false, message: "Cette question a déjà été lancée." };

    // Heure réelle : la question se joue pendant la vraie course, même si l'horloge est simulée.
    const opensAt = new Date();
    const closesAt = new Date(opensAt.getTime() + minutes * 60_000);
    const { error } = await admin
      .from("bonus_questions")
      .update({ opens_at: opensAt.toISOString(), closes_at: closesAt.toISOString() })
      .eq("id", questionId)
      .is("opens_at", null);
    if (error) throw new Error(error.message);
    revalidate(question.race_id);

    // La question est ouverte même si l'envoi échoue (Firebase pas encore configuré, par exemple) :
    // les joueurs la voient alors sur l'accueil et en pop-up.
    let pushNote: string;
    try {
      const report = await sendPush({
        title: `🔴 Question live · +${BONUS_QUESTION_POINTS} pts`,
        body: question.question,
        url: `/courses/${question.race_id}`,
      });
      pushNote = `Notification envoyée à ${report.sent} téléphone(s) sur ${report.devices}.`;
    } catch (pushError) {
      pushNote = `Notification non envoyée : ${pushError instanceof Error ? pushError.message : "erreur inconnue"}.`;
    }
    return { ok: true, message: `Question ouverte pendant ${minutes} min. ${pushNote}` };
  } catch (error) {
    return fail(error);
  }
}

/** Ferme tout de suite une question live en cours. */
export async function closeLiveQuestion(questionId: string): Promise<BonusQuestionActionResult> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("bonus_questions")
      .update({ closes_at: now })
      .eq("id", questionId)
      .eq("kind", "live")
      .gt("closes_at", now)
      .select("race_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ok: false, message: "Question déjà fermée." };
    revalidate(data.race_id);
    return { ok: true, message: "Question fermée." };
  } catch (error) {
    return fail(error);
  }
}

/** Supprime une question : ses réponses et les points qu'elle a rapportés disparaissent aussi. */
export async function deleteBonusQuestion(questionId: string): Promise<BonusQuestionActionResult> {
  try {
    await requireAdmin();
    const { data, error } = await createAdminClient()
      .from("bonus_questions")
      .delete()
      .eq("id", questionId)
      .select("race_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) revalidate(data.race_id);
    return { ok: true, message: "Question supprimée." };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Saisit (ou corrige, ou efface avec null) la bonne réponse d'une question fermée, puis renote :
 * BONUS_QUESTION_POINTS pour chaque bonne réponse, 0 pour les autres (lignes de score_ledger
 * de la question réécrites à chaque fois).
 */
export async function setBonusQuestionAnswer(questionId: string, correctOption: number | null): Promise<BonusQuestionActionResult> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data: question, error: readError } = await admin
      .from("bonus_questions")
      .select("id, race_id, kind, options, opens_at, closes_at, races(locks_at, stages(season_id))")
      .eq("id", questionId)
      .single();
    if (readError || !question) throw new Error(readError?.message ?? "Question introuvable.");
    const race = question.races as any;
    if (correctOption !== null && (!Number.isInteger(correctOption) || correctOption < 0 || correctOption >= question.options.length)) {
      return { ok: false, message: "Réponse inconnue." };
    }
    // Heure réelle pour une question live, départ de la course (heure réelle) avant le départ.
    if (bonusQuestionState(question as any, race.locks_at, new Date()) !== "closed") {
      return { ok: false, message: "Attends que la question soit fermée pour saisir la bonne réponse." };
    }

    const { error: updateError } = await admin.from("bonus_questions").update({ correct_option: correctOption }).eq("id", questionId);
    if (updateError) throw new Error(updateError.message);

    const { error: deleteError } = await admin.from("score_ledger").delete().eq("bonus_question_id", questionId);
    if (deleteError) throw new Error(deleteError.message);

    let winners = 0;
    if (correctOption !== null) {
      const { data: answers, error: answersError } = await admin
        .from("bonus_answers")
        .select("user_id, option_index")
        .eq("question_id", questionId);
      if (answersError) throw new Error(answersError.message);
      const rows = bonusQuestionLedgerRows(answers ?? [], correctOption, questionId, race.stages.season_id);
      if (rows.length) {
        const { error } = await admin.from("score_ledger").insert(rows);
        if (error) throw new Error(error.message);
      }
      winners = rows.length;
    }
    revalidate(question.race_id);
    return {
      ok: true,
      message:
        correctOption === null
          ? "Bonne réponse effacée, points retirés."
          : `Bonne réponse enregistrée : ${winners} joueur(s) gagnent ${BONUS_QUESTION_POINTS} pts.`,
    };
  } catch (error) {
    return fail(error);
  }
}
