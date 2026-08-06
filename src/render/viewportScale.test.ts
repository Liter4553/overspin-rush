import { describe, expect, it } from "vitest";
import { computeFitScale } from "./viewportScale";

describe("computeFitScale", () => {
  it("세로가 더 빡빡하면 세로 기준으로 맞춘다", () => {
    // 자연 크기 480x1200, 가용 800x900 -> 세로 배율 0.75가 가로 배율(1.67)보다 작음
    const scale = computeFitScale(480, 1200, 800, 900, 0.1, 10);
    expect(scale).toBeCloseTo(0.75);
  });

  it("가로가 더 빡빡하면 가로 기준으로 맞춘다", () => {
    const scale = computeFitScale(1000, 500, 400, 1000, 0.1, 10);
    expect(scale).toBeCloseTo(0.4);
  });

  it("최대 배율을 넘지 않는다", () => {
    const scale = computeFitScale(100, 100, 1000, 1000, 0.1, 1.5);
    expect(scale).toBe(1.5);
  });

  it("최소 배율 아래로 내려가지 않는다", () => {
    const scale = computeFitScale(1000, 1000, 100, 100, 0.5, 2);
    expect(scale).toBe(0.5);
  });

  it("자연 크기가 0 이하면 1을 반환한다", () => {
    expect(computeFitScale(0, 500, 800, 900, 0.1, 2)).toBe(1);
  });
});
