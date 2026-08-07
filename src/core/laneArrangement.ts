// 노트 배치(정배/미러) 변환. 채보 원본은 건드리지 않고 새 배열을 반환한다(SPEC.md 6절).
// 대상은 노트 레인 0~2뿐이다 — FX/스크래치는 항상 그대로 둔다.
import type { ChartNote } from "../chart/types";

export type Arrangement = "normal" | "mirror";

const MIRROR_MAP: Readonly<Record<0 | 1 | 2, 0 | 1 | 2>> = { 0: 2, 1: 1, 2: 0 };

export function applyArrangement(notes: readonly ChartNote[], arrangement: Arrangement): ChartNote[] {
  if (arrangement === "normal") return notes.map((note) => ({ ...note }));
  return notes.map((note) => {
    if (note.lane === 0 || note.lane === 1 || note.lane === 2) {
      return { ...note, lane: MIRROR_MAP[note.lane] };
    }
    return { ...note };
  });
}
