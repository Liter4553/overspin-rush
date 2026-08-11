// "노트 속도"(작을수록 빠름) 옵션 순수 로직. 곡 시작(또는 실시간 변경) 시점의 BPM을
// 기준으로 낙하 시간을 한 번만 계산해 고정하고, 이후 곡 중간에 BPM이 바뀌면 그 비율만큼
// 스크롤 속도에 그대로 반영한다(그린넘버처럼 BPM 변화를 상쇄해 항상 똑같이 보이게 하지 않는다).
import { NOTE_SPEED_MAX, NOTE_SPEED_MIN, NOTE_SPEED_STEP } from "../config";

// 노트 속도와 "그 시점" BPM으로부터 낙하 시간(ms)을 계산한다. 곡 시작/실시간 변경
// 시점에 한 번 호출해서 기준값(고정)을 만드는 용도 — 노트 속도가 작을수록 짧게(빠르게) 나온다.
export function fallTimeMsForNoteSpeed(noteSpeed: number, bpm: number, baseGreenNumberMs: number): number {
  if (bpm <= 0) return baseGreenNumberMs;
  return (baseGreenNumberMs * noteSpeed) / bpm;
}

// 고정해둔 기준 낙하 시간을, 기준 BPM 대비 지금 BPM의 비율만큼 그대로 조정한다.
// BPM이 느려지면(currentBpm < referenceBpm) 낙하 시간이 늘어나(더 느리게 보임),
// 빨라지면 줄어든다(더 빠르게 보임) — 배속 자체는 재계산하지 않는다.
export function scaleFallTimeMsForCurrentBpm(fallTimeMsAtReference: number, referenceBpm: number, currentBpm: number): number {
  if (referenceBpm <= 0 || currentBpm <= 0) return fallTimeMsAtReference;
  return fallTimeMsAtReference * (referenceBpm / currentBpm);
}

// NOTE_SPEED_STEP 단위로 반올림하고 NOTE_SPEED_MIN~MAX 범위로 clamp한다.
export function clampNoteSpeed(noteSpeed: number): number {
  const stepped = Math.round(noteSpeed / NOTE_SPEED_STEP) * NOTE_SPEED_STEP;
  return Math.min(NOTE_SPEED_MAX, Math.max(NOTE_SPEED_MIN, stepped));
}
