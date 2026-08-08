// 곡+난이도별 최고 점수. 게이지 타입과 무관하게 점수 하나만 관리한다(점수 계산 자체가
// 게이지 타입에 좌우되지 않으므로). 직렬화/역직렬화는 순수 함수로만 구성하고, 실제
// localStorage 접근은 main.ts의 얇은 어댑터가 담당한다(clearRecords.ts와 동일 패턴).
import type { Difficulty } from "../chart/songList";

export type HighScores = Readonly<Record<string, number>>;

export function highScoreKey(songId: string, difficulty: Difficulty): string {
  return `${songId}:${difficulty}`;
}

export function createEmptyHighScores(): HighScores {
  return {};
}

export function upsertHighScore(scores: HighScores, key: string, score: number): HighScores {
  const existing = scores[key];
  if (existing !== undefined && existing >= score) return scores;
  return { ...scores, [key]: score };
}

export function serializeHighScores(scores: HighScores): string {
  return JSON.stringify(scores);
}

export function parseHighScores(raw: string | null): HighScores {
  if (raw === null) return createEmptyHighScores();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return createEmptyHighScores();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return createEmptyHighScores();

  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
  }
  return result;
}
