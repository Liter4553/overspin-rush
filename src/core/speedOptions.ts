// 그린넘버(IIDX식: "그린넘버 = BPM x 배속") 순수 변환 로직.
// 진짜 상태는 그린넘버 하나뿐이고, 배속과 낙하 시간(ms)은 매 순간의 BPM으로부터
// 그때그때 계산되는 파생값이다 — BPM이 달라져도 체감 낙하 속도가 그대로 유지된다.
import { GREEN_NUMBER_MAX, GREEN_NUMBER_MIN, GREEN_NUMBER_STEP } from "../config";

export function speedMultiplierForBpm(greenNumber: number, bpm: number): number {
  if (bpm <= 0) return 0;
  return greenNumber / bpm;
}

// 렌더링(noteY)이 바로 쓸 수 있는 낙하 시간(ms). 배속이 0 이하로 나오는 예외적인
// BPM(0 이하)에서는 baseGreenNumberMs를 그대로 폴백한다.
export function fallTimeMsForBpm(greenNumber: number, bpm: number, baseGreenNumberMs: number): number {
  const speed = speedMultiplierForBpm(greenNumber, bpm);
  if (speed <= 0) return baseGreenNumberMs;
  return baseGreenNumberMs / speed;
}

// GREEN_NUMBER_STEP 단위로 반올림하고 GREEN_NUMBER_MIN~MAX 범위로 clamp한다.
export function clampGreenNumber(greenNumber: number): number {
  const stepped = Math.round(greenNumber / GREEN_NUMBER_STEP) * GREEN_NUMBER_STEP;
  return Math.min(GREEN_NUMBER_MAX, Math.max(GREEN_NUMBER_MIN, stepped));
}
