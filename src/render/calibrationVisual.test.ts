import { describe, expect, it } from "vitest";
import { calibrationIndicatorProgress, isCalibrationBeatFlash } from "./calibrationVisual";

describe("calibrationIndicatorProgress", () => {
  it("박 시점(nowMs === nextBeatTimeMs)이면 0이다", () => {
    expect(calibrationIndicatorProgress(1000, 1000, 500)).toBe(0);
  });

  it("리드인 시작 시점(nowMs === nextBeatTimeMs - leadMs)이면 1이다", () => {
    expect(calibrationIndicatorProgress(500, 1000, 500)).toBe(1);
  });

  it("리드인보다 훨씬 이르면 1로 clamp된다", () => {
    expect(calibrationIndicatorProgress(0, 1000, 500)).toBe(1);
  });

  it("박을 이미 지났으면 0으로 clamp된다", () => {
    expect(calibrationIndicatorProgress(1200, 1000, 500)).toBe(0);
  });

  it("중간 지점은 선형으로 보간된다", () => {
    expect(calibrationIndicatorProgress(750, 1000, 500)).toBeCloseTo(0.5, 5);
  });
});

describe("isCalibrationBeatFlash", () => {
  it("허용 범위 안이면 true다", () => {
    expect(isCalibrationBeatFlash(1005, 1000, 60)).toBe(true);
    expect(isCalibrationBeatFlash(960, 1000, 60)).toBe(true);
  });

  it("허용 범위를 벗어나면 false다", () => {
    expect(isCalibrationBeatFlash(1100, 1000, 60)).toBe(false);
  });
});
