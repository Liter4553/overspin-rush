// 박자표(변박 포함) 계산. 렌더링/DOM과 분리된 순수 함수만 모아둔다(SPEC.md 10절).
//
// 틱 해상도는 항상 16분음표 1개 = 1틱이다. 따라서 한 마디의 틱 수는
//   분자 * (16 / 분모)
// 로 유도된다 — 4/4=16틱, 3/4=12틱, 7/8=14틱, 5/16=5틱.
// 분모는 16을 나누어떨어지게 하는 값만 허용한다(정수 틱으로 떨어져야 하므로).
import { DEFAULT_TIME_SIGNATURE, TICKS_PER_WHOLE_NOTE, VALID_TIME_SIGNATURE_DENOMINATORS } from "../config";

export interface TimeSignature {
  bar: number; // 이 박자표가 적용되기 시작하는 마디(1부터). 그 다음 변경 전까지 유지된다.
  numerator: number; // 한 마디의 박 수
  denominator: number; // 한 박의 음표 길이(4=4분음표, 8=8분음표)
}

export function isValidDenominator(denominator: number): boolean {
  return VALID_TIME_SIGNATURE_DENOMINATORS.includes(denominator);
}

export function ticksPerMeasure(signature: { numerator: number; denominator: number }): number {
  return signature.numerator * (TICKS_PER_WHOLE_NOTE / signature.denominator);
}

// 변경 목록은 bar 오름차순 정렬되어 있다고 가정한다(parseChart/parsePattern이 정렬해서 넘긴다).
// 첫 변경보다 앞선 마디에는 기본값 4/4가 적용된다.
export function signatureAtBar(
  signatures: readonly TimeSignature[],
  bar: number,
): { numerator: number; denominator: number } {
  let current: { numerator: number; denominator: number } = DEFAULT_TIME_SIGNATURE;
  for (const signature of signatures) {
    if (signature.bar > bar) break;
    current = signature;
  }
  return current;
}

// 해당 마디의 첫 틱이 절대틱 몇인지. 변박이 있으면 마디마다 길이가 달라지므로
// 1마디부터 차례로 걸어서 누적한다.
export function barStartAbsoluteTick(signatures: readonly TimeSignature[], bar: number): number {
  let absoluteTick = 0;
  for (let b = 1; b < bar; b++) {
    absoluteTick += ticksPerMeasure(signatureAtBar(signatures, b));
  }
  return absoluteTick;
}

// 절대틱이 몇 마디 몇 틱인지(barStartAbsoluteTick의 역변환). 에디터/표시용.
export function absoluteTickToBarTick(
  signatures: readonly TimeSignature[],
  absoluteTick: number,
): { bar: number; tick: number } {
  let bar = 1;
  let remaining = absoluteTick;
  for (;;) {
    const measureTicks = ticksPerMeasure(signatureAtBar(signatures, bar));
    if (remaining < measureTicks) return { bar, tick: remaining };
    remaining -= measureTicks;
    bar++;
  }
}
