import { describe, expect, it } from "vitest";
import {
  generateCalibrationBeatScheduleMs,
  suggestAudioOffsetMs,
  suggestInputOffsetMs,
  summarizeCalibrationTest,
  type CalibrationTestResult,
} from "./calibration";
import { computeErrorMs } from "./judge";
import { CALIBRATION_MIN_MATCHED_BEATS, OFFSET_MAX_MS, OFFSET_MIN_MS } from "../config";

describe("generateCalibrationBeatScheduleMs", () => {
  it("BPM 120 · 4/4 · 4마디 = 16박을 500ms 간격으로 생성한다", () => {
    const schedule = generateCalibrationBeatScheduleMs(1000);
    expect(schedule).toHaveLength(16);
    expect(schedule[0]).toBe(1000);
    expect(schedule[1]).toBe(1500);
    expect(schedule[15]).toBe(1000 + 15 * 500);
  });
});

describe("summarizeCalibrationTest", () => {
  it("모든 입력이 일정하게 30ms 늦으면 평균 오차 30ms, 전부 매칭된다", () => {
    const beats = generateCalibrationBeatScheduleMs(0);
    const presses = beats.map((b) => b + 30);
    const result = summarizeCalibrationTest(presses, beats);
    expect(result.matchedCount).toBe(16);
    expect(result.averageErrorMs).toBeCloseTo(30, 5);
    expect(result.insufficientSamples).toBe(false);
  });

  it("허용 오차(200ms)를 벗어난 입력은 매칭에서 제외되어 평균을 왜곡하지 않는다", () => {
    const beats = generateCalibrationBeatScheduleMs(0);
    // 마지막 박만 500ms나 벗어난 이상치. 나머지는 정확히 10ms 늦음.
    const presses = beats.slice(0, 15).map((b) => b + 10);
    presses.push(beats[15] + 500);
    const result = summarizeCalibrationTest(presses, beats);
    expect(result.matchedCount).toBe(15);
    expect(result.averageErrorMs).toBeCloseTo(10, 5);
  });

  it("놓친 박은 매칭되지 않고, 표본이 기준치 미만이면 insufficientSamples가 true다", () => {
    const beats = generateCalibrationBeatScheduleMs(0);
    const presses = beats.slice(0, CALIBRATION_MIN_MATCHED_BEATS - 1).map((b) => b + 5);
    const result = summarizeCalibrationTest(presses, beats);
    expect(result.matchedCount).toBe(CALIBRATION_MIN_MATCHED_BEATS - 1);
    expect(result.insufficientSamples).toBe(true);
  });

  it("정확히 기준치만큼 매칭되면 표본 부족이 아니다", () => {
    const beats = generateCalibrationBeatScheduleMs(0);
    const presses = beats.slice(0, CALIBRATION_MIN_MATCHED_BEATS).map((b) => b + 5);
    const result = summarizeCalibrationTest(presses, beats);
    expect(result.matchedCount).toBe(CALIBRATION_MIN_MATCHED_BEATS);
    expect(result.insufficientSamples).toBe(false);
  });

  it("입력이 하나도 없으면 매칭 0, 평균 오차 0이다", () => {
    const beats = generateCalibrationBeatScheduleMs(0);
    const result = summarizeCalibrationTest([], beats);
    expect(result.matchedCount).toBe(0);
    expect(result.averageErrorMs).toBe(0);
    expect(result.insufficientSamples).toBe(true);
  });
});

describe("suggestInputOffsetMs / suggestAudioOffsetMs", () => {
  function fakeResult(averageErrorMs: number): CalibrationTestResult {
    return { matchedCount: 16, totalBeats: 16, averageErrorMs, insufficientSamples: false };
  }

  it("시각 테스트 평균 오차의 부호를 뒤집어 입력 오프셋을 제안한다", () => {
    expect(suggestInputOffsetMs(fakeResult(30))).toBe(-30);
    expect(suggestInputOffsetMs(fakeResult(-15))).toBe(15);
  });

  it("오디오 테스트 오차 + 입력 오프셋으로 오디오 오프셋을 제안한다", () => {
    expect(suggestAudioOffsetMs(fakeResult(40), -25)).toBe(15);
  });

  it("제안값은 OFFSET_MIN_MS~OFFSET_MAX_MS 범위로 clamp된다", () => {
    expect(suggestInputOffsetMs(fakeResult(1000))).toBe(OFFSET_MIN_MS);
    expect(suggestInputOffsetMs(fakeResult(-1000))).toBe(OFFSET_MAX_MS);
  });

  it("실제 지연 시나리오를 왕복 검증한다: 입력 25ms 지연 + 오디오 경로에서만 추가 15ms 지연", () => {
    const beats = generateCalibrationBeatScheduleMs(0);
    const inputLatencyMs = 25;
    const audioLatencyMs = 15;

    // 시각 테스트: 오디오가 없으므로 입력 지연만 반영된다.
    const visualPresses = beats.map((b) => b + inputLatencyMs);
    const visualResult = summarizeCalibrationTest(visualPresses, beats);
    const suggestedInputOffsetMs = suggestInputOffsetMs(visualResult);
    expect(suggestedInputOffsetMs).toBe(-inputLatencyMs);

    // 오디오 테스트: 입력 지연 + 오디오 경로 지연이 함께 반영된다.
    const audioPresses = beats.map((b) => b + inputLatencyMs + audioLatencyMs);
    const audioResult = summarizeCalibrationTest(audioPresses, beats);
    const suggestedAudioOffsetMs = suggestAudioOffsetMs(audioResult, suggestedInputOffsetMs);
    expect(suggestedAudioOffsetMs).toBe(audioLatencyMs);

    // 실제 판정 공식에 제안값을 넣으면 두 테스트 모두 평균 오차가 0에 가까워야 한다.
    // 시각 테스트는 오디오 경로가 없으므로 audioOffsetMs는 0으로 취급한다.
    const visualErrors = visualPresses.map((p, i) => computeErrorMs(p, beats[i], 0, suggestedInputOffsetMs));
    const avgVisualError = visualErrors.reduce((a, b) => a + b, 0) / visualErrors.length;
    expect(avgVisualError).toBeCloseTo(0, 5);

    const audioErrors = audioPresses.map((p, i) => computeErrorMs(p, beats[i], suggestedAudioOffsetMs, suggestedInputOffsetMs));
    const avgAudioError = audioErrors.reduce((a, b) => a + b, 0) / audioErrors.length;
    expect(avgAudioError).toBeCloseTo(0, 5);
  });
});
