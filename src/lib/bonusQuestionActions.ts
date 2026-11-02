"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOpenLiveQuestions } from "./bonusQuestions";

export type AnswerBonusQuestionResult = { ok: true } | { ok: false; error: "notAuthenticated" | "closed" | "unknown" };

/** Réponse du joueur connecté à une question bonus (fonction answer_bonus_question, migration 0033). */
export async function answerBonusQuestion(questionId: string, option: number): Promise<AnswerBonusQuestionResult> {
  if (typeof questionId !== "string" || !Number.isInteger(option)) return { ok: false, error: "unknown" };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const { error } = await supabase.rpc("answer_bonus_question", { p_question_id: questionId, p_option: option });
  if (error) {
    if (error.message.includes("question_closed")) return { ok: false, error: "closed" };
    if (error.message.includes("not_authenticated")) return { ok: false, error: "notAuthenticated" };
    console.error("answerBonusQuestion:", error.message);
    return { ok: false, error: "unknown" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export interface LiveQuestionInvite {
  id: string;
  raceId: string;
  question: string;
  closesAt: string;
  /** Millisecondes restantes au moment de la lecture (le navigateur décompte à partir de là). */
  remainingMs: number;
}

/**
 * Questions live ouvertes auxquelles le joueur n'a pas encore répondu : lues par le pop-up toutes
 * les minutes et à chaque changement de page.
 */
export async function fetchLiveQuestionInvites(): Promise<LiveQuestionInvite[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const now = new Date();
  const questions = await getOpenLiveQuestions(supabase, user.id, now);
  return questions
    .filter((q) => q.myAnswer === null)
    .map((q) => ({
      id: q.id,
      raceId: q.raceId,
      question: q.question,
      closesAt: q.closesAt,
      remainingMs: Math.max(0, new Date(q.closesAt).getTime() - now.getTime()),
    }));
}
