// 판정 로직. 렌더링/DOM과 완전히 분리된 순수 함수로만 구성한다 (SPEC.md 10절).

export type JudgeGrade = "PERFECT_PLUS" | "PERFECT" | "GREAT" | "GOOD" | "MISS";

export interface JudgeTableEntry {
  grade: JudgeGrade;
  windowMs: number; // 패스트/슬로우 각각의 한계값(대칭). 경계는 이하(≤) 포함.
  score: number;
}

export interface JudgeResult {
  grade: JudgeGrade;
  score: number;
}

export type TimingSign = "FAST" | "SLOW" | null;

// table은 windowMs 오름차순이어야 한다. 절대 오차가 처음으로 windowMs 이하인 항목을 채택.
export function judge(absErrorMs: number, table: readonly JudgeTableEntry[]): JudgeResult {
  for (const entry of table) {
    if (absErrorMs <= entry.windowMs) {
      return { grade: entry.grade, score: entry.score };
    }
  }
  return { grade: "MISS", score: 0 };
}

// 오차의 부호: 음수 = FAST(빠름), 양수 = SLOW(느림), 0 = 정타.
export function timingSign(errorMs: number): TimingSign {
  if (errorMs < 0) return "FAST";
  if (errorMs > 0) return "SLOW";
  return null;
}

// 표시/집계에 쓰는 부호. PERFECT+는 정타 취급이라 FAST/SLOW를 절대 표시하지 않는다
// (SPEC.md 4절 — 스크래치의 40ms짜리 PERFECT+ 범위도 동일하게 적용).
export function displaySign(grade: JudgeGrade, errorMs: number): TimingSign {
  if (grade === "PERFECT_PLUS") return null;
  return timingSign(errorMs);
}

// 오디오/입력 오프셋(ms)을 반영한 최종 오차. 오프셋 조절 UI는 마일스톤 8에서 연결된다.
export function computeErrorMs(
  inputTimeMs: number,
  noteTimeMs: number,
  audioOffsetMs: number,
  inputOffsetMs: number,
): number {
  return inputTimeMs + inputOffsetMs - (noteTimeMs + audioOffsetMs);
}
