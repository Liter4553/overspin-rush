// 곡+난이도+게이지타입별 최고 클리어 등급 기록. 직렬화/역직렬화는 순수 함수로만 구성하고,
// 실제 localStorage 접근은 main.ts의 얇은 어댑터가 담당한다(optionsStorage.ts와 동일 패턴).
import type { Difficulty } from "../chart/songList";
import type { GaugeType } from "../config";
import type { ClearGrade } from "./clearGrade";

export type ClearRecords = Readonly<Record<string, ClearGrade>>;

export function clearRecordKey(songId: string, difficulty: Difficulty, gaugeType: GaugeType): string {
  return `${songId}:${difficulty}:${gaugeType}`;
}

const VALID_GRADES: readonly ClearGrade[] = [
  "FAILED",
  "CLEAR",
  "HARD_CLEAR",
  "CHALLENGE_CLEAR",
  "FULL_COMBO",
  "PERFECT",
];

// HARD_CLEAR/CHALLENGE_CLEAR는 같은 키 안에서는 등장하지 않는다(게이지 타입이 키에
// 이미 고정돼 있으므로) — "클리어했다"는 사실 자체만 비교하면 되므로 같은 순위로 둔다.
const GRADE_RANK: Readonly<Record<ClearGrade, number>> = {
  FAILED: 0,
  CLEAR: 1,
  HARD_CLEAR: 1,
  CHALLENGE_CLEAR: 1,
  FULL_COMBO: 2,
  PERFECT: 3,
};

function isValidGrade(value: unknown): value is ClearGrade {
  return typeof value === "string" && (VALID_GRADES as readonly string[]).includes(value);
}

export function createEmptyClearRecords(): ClearRecords {
  return {};
}

// 기존 기록보다 나쁘거나 같은 등급이면 그대로 두고, 더 좋은 등급일 때만 갱신한다.
export function upsertBestGrade(records: ClearRecords, key: string, grade: ClearGrade): ClearRecords {
  const existing = records[key];
  if (existing !== undefined && GRADE_RANK[existing] >= GRADE_RANK[grade]) return records;
  return { ...records, [key]: grade };
}

export function serializeClearRecords(records: ClearRecords): string {
  return JSON.stringify(records);
}

// 저장된 값이 없거나 형식이 깨졌으면 빈 기록으로 안전하게 대체한다. 개별 항목이
// 손상됐으면(예: 알 수 없는 등급 문자열) 그 항목만 건너뛴다.
export function parseClearRecords(raw: string | null): ClearRecords {
  if (raw === null) return createEmptyClearRecords();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return createEmptyClearRecords();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return createEmptyClearRecords();

  const result: Record<string, ClearGrade> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (isValidGrade(value)) result[key] = value;
  }
  return result;
}

// 선곡 리스트는 곡+난이도 하나에 게이지 타입 3개를 각각 표시할 자리가 없어서,
// 그중 가장 좋은 등급 하나만 대표로 보여준다(상세 기록은 결과 화면에서 확인).
export function bestGradeForSong(
  records: ClearRecords,
  songId: string,
  difficulty: Difficulty,
  gaugeTypes: readonly GaugeType[],
): ClearGrade | null {
  let best: ClearGrade | null = null;
  for (const gaugeType of gaugeTypes) {
    const grade = records[clearRecordKey(songId, difficulty, gaugeType)];
    if (grade === undefined) continue;
    if (best === null || GRADE_RANK[grade] > GRADE_RANK[best]) best = grade;
  }
  return best;
}
