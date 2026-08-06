import type { Chart, ChartNote, NoteLane } from "../chart/types";
import type { JudgeGrade } from "./judge";

export type NoteState = "pending" | "judged";

export interface TrackedNote {
  note: ChartNote;
  state: NoteState;
  grade: JudgeGrade | null;
  errorMs: number | null;
}

export function createNoteTracker(chart: Chart): TrackedNote[] {
  return chart.notes.map((note) => ({ note, state: "pending", grade: null, errorMs: null }));
}

// 레인 안에서 입력 윈도우(windowMs) 내의 미판정 노트 중 시간이 가장 가까운 것을 찾는다.
// 판정 가능한 노트가 없으면 null — 이 경우 입력은 조용히 무시된다(SPEC.md 4절 관련 결정).
export function findNearestPendingNote(
  tracked: readonly TrackedNote[],
  lane: NoteLane,
  inputTimeMs: number,
  windowMs: number,
): TrackedNote | null {
  let best: TrackedNote | null = null;
  let bestDiff = Infinity;
  for (const t of tracked) {
    if (t.state !== "pending" || t.note.lane !== lane) continue;
    const diff = Math.abs(inputTimeMs - t.note.time);
    if (diff <= windowMs && diff < bestDiff) {
      best = t;
      bestDiff = diff;
    }
  }
  return best;
}

// currentTimeMs 기준 슬로우 윈도우를 넘긴 pending 노트를 MISS로 전환하고, 새로 MISS된 노트만 반환한다.
export function applyAutoMiss(
  tracked: readonly TrackedNote[],
  currentTimeMs: number,
  windowMs: number,
): TrackedNote[] {
  const newlyMissed: TrackedNote[] = [];
  for (const t of tracked) {
    if (t.state === "pending" && currentTimeMs - t.note.time > windowMs) {
      t.state = "judged";
      t.grade = "MISS";
      t.errorMs = null;
      newlyMissed.push(t);
    }
  }
  return newlyMissed;
}

export function markJudged(tracked: TrackedNote, grade: JudgeGrade, errorMs: number): void {
  tracked.state = "judged";
  tracked.grade = grade;
  tracked.errorMs = errorMs;
}
