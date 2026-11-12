/**
 * Question sources for in-call games: the curated non-repeating decks in
 * gameDecks.ts, plus optional AI-generated prompts (with a curated fallback).
 */
import {
  DEEP_QUESTIONS,
  WYR_CARDS,
  getNextDeepQuestion,
  getNextWYRCard,
  type DeepQuestion,
  type WYRCard,
} from '@/lib/gameDecks';

export type { DeepQuestion, WYRCard };
/** @deprecated kept for older imports; use DeepQuestion */
export type DarkQuestion = DeepQuestion;

export const ALL_DARK_QUESTIONS = DEEP_QUESTIONS;
export const ALL_WYR_CARDS = WYR_CARDS;

export const getNextCuratedDarkQuestion = getNextDeepQuestion;
export const getNextCuratedWYRCard = getNextWYRCard;

const MAX_LEN = 220;
const isCleanText = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 5 && v.trim().length <= MAX_LEN;

async function requestAI(body: Record<string, string>): Promise<any | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch('/api/ai/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** A fresh AI question, or the next curated one if AI is unavailable or returns junk. */
export async function generateAIDarkQuestion(): Promise<DeepQuestion> {
  const data = await requestAI({ type: 'question' });
  if (data && isCleanText(data.question)) {
    return {
      category: isCleanText(data.category) ? data.category.trim() : 'AI Pick',
      question: data.question.trim(),
      tag: typeof data.tag === 'string' && data.tag.trim() ? data.tag.trim().slice(0, 30) : 'Fresh',
    };
  }
  return getNextDeepQuestion();
}

/** A fresh AI Would You Rather card, or the next curated one. */
export async function generateAIWYRCard(): Promise<WYRCard> {
  const data = await requestAI({ type: 'wyr' });
  if (data && isCleanText(data.optionA) && isCleanText(data.optionB)) {
    return { optionA: data.optionA.trim(), optionB: data.optionB.trim() };
  }
  return getNextWYRCard();
}
