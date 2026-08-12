// 오프셋 자동 보정 마법사(SPEC.md 6절)의 순수 로직.
//
// "소리가 늦게 나오는 것"과 "입력이 늦게 인식되는 것"은 단순 탭 테스트 하나로는 수학적으로
// 분리할 수 없다 — 둘 다 똑같이 "소리/화면과 입력 사이의 어긋남"으로만 관측되기 때문이다.
// 이를 우회하기 위해 두 단계로 나눠 측정한다:
//   1) 시각 테스트(소리 없음): 오디오가 전혀 개입하지 않으므로, 측정된 평균 오차는 순수하게
//      입력 오프셋(입력 장치 지연 + 반응 지연)만 반영한다.
//      제안 입력 오프셋 = -visualError
//   2) 오디오 테스트(쿵짝 드럼): 위에서 구한 입력 오프셋을 그대로 두고, 오디오 경로에서만
//      추가로 발생하는 지연을 역산한다.
//      제안 오디오 오프셋 = audioError + 제안 입력 오프셋
import {
  CALIBRATION_BEATS_PER_MEASURE,
  CALIBRATION_BPM,
  CALIBRATION_MATCH_TOLERANCE_MS,
  CALIBRATION_MEASURES,
  CALIBRATION_MIN_MATCHED_BEATS,
  OFFSET_MAX_MS,
  OFFSET_MIN_MS,
} from "../config";

export interface CalibrationTestResult {
  matchedCount: number;
  totalBeats: number;
  averageErrorMs: number; // 매칭된 것만의 평균 (press - beat). 매칭이 하나도 없으면 0.
  insufficientSamples: boolean;
}

// startTimeMs를 첫 박으로, CALIBRATION_BPM 기준 등간격으로 총 16박(4/4 4마디)의 스케줄을 만든다.
export function generateCalibrationBeatScheduleMs(startTimeMs: number): number[] {
  const beatIntervalMs = 60000 / CALIBRATION_BPM;
  const totalBeats = CALIBRATION_BEATS_PER_MEASURE * CALIBRATION_MEASURES;
  return Array.from({ length: totalBeats }, (_, i) => startTimeMs + i * beatIntervalMs);
}

// 각 박에 대해 아직 쓰이지 않은 입력 중 허용 오차 안에서 가장 가까운 것을 하나씩 매칭한다
// (그리디). 놓친 박이나 허용 오차를 벗어난 입력은 매칭에서 제외되어 평균에 영향을 주지 않는다.
export function summarizeCalibrationTest(
  pressTimesMs: readonly number[],
  beatTimesMs: readonly number[],
): CalibrationTestResult {
  const usedPressIndices = new Set<number>();
  const errors: number[] = [];

  for (const beat of beatTimesMs) {
    let bestIndex = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < pressTimesMs.length; i++) {
      if (usedPressIndices.has(i)) continue;
      const diff = Math.abs(pressTimesMs[i] - beat);
      if (diff <= CALIBRATION_MATCH_TOLERANCE_MS && diff < bestDiff) {
        bestDiff = diff;
        bestIndex = i;
      }
    }
    if (bestIndex !== -1) {
      usedPressIndices.add(bestIndex);
      errors.push(pressTimesMs[bestIndex] - beat);
    }
  }

  const matchedCount = errors.length;
  const averageErrorMs = matchedCount === 0 ? 0 : errors.reduce((sum, e) => sum + e, 0) / matchedCount;

  return {
    matchedCount,
    totalBeats: beatTimesMs.length,
    averageErrorMs,
    insufficientSamples: matchedCount < CALIBRATION_MIN_MATCHED_BEATS,
  };
}

function clampOffsetMs(value: number): number {
  return Math.min(OFFSET_MAX_MS, Math.max(OFFSET_MIN_MS, value));
}

export function suggestInputOffsetMs(visualResult: CalibrationTestResult): number {
  return clampOffsetMs(Math.round(-visualResult.averageErrorMs));
}

export function suggestAudioOffsetMs(audioResult: CalibrationTestResult, suggestedInputOffsetMs: number): number {
  return clampOffsetMs(Math.round(audioResult.averageErrorMs + suggestedInputOffsetMs));
}
