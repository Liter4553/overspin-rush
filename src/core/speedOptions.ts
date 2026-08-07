// 배속 <-> 그린넘버 변환. 진짜 상태는 effectiveGreenNumberMs 하나뿐이고,
// 배속은 그 값을 보여주고 조작하는 또 다른 입력 경로일 뿐이다 (SPEC.md 6절).
import { SPEED_MAX, SPEED_MIN, SPEED_STEP } from "../config";

export function speedToGreenNumberMs(speedMultiplier: number, baseGreenNumberMs: number): number {
  return baseGreenNumberMs / speedMultiplier;
}

export function greenNumberMsToSpeed(greenNumberMs: number, baseGreenNumberMs: number): number {
  return baseGreenNumberMs / greenNumberMs;
}

// 0.25 단위로 반올림하고 SPEED_MIN~SPEED_MAX 범위로 clamp한다.
export function clampSpeed(speedMultiplier: number): number {
  const stepped = Math.round(speedMultiplier / SPEED_STEP) * SPEED_STEP;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, stepped));
}
