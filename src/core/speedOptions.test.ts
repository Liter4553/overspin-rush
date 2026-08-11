import { describe, expect, it } from "vitest";
import { clampGreenNumber, fallTimeMsForBpm, speedMultiplierForBpm } from "./speedOptions";

describe("speedMultiplierForBpm", () => {
  it("그린넘버와 BPM이 같으면 배속 1.0x다", () => {
    expect(speedMultiplierForBpm(150, 150)).toBe(1);
  });

  it("BPM이 그린넘버보다 높으면 배속은 1.0x 미만으로 자동으로 낮아진다", () => {
    expect(speedMultiplierForBpm(150, 300)).toBe(0.5);
  });

  it("BPM이 그린넘버보다 낮으면 배속은 1.0x 초과로 자동으로 높아진다", () => {
    expect(speedMultiplierForBpm(150, 75)).toBe(2);
  });

  it("BPM이 0 이하면 0을 반환한다(예외 방어)", () => {
    expect(speedMultiplierForBpm(150, 0)).toBe(0);
  });
});

describe("fallTimeMsForBpm", () => {
  it("배속 1.0x(그린넘버==BPM)에서는 baseGreenNumberMs 그대로다", () => {
    expect(fallTimeMsForBpm(150, 150, 800)).toBe(800);
  });

  it("같은 그린넘버라도 BPM이 2배면 낙하 시간도 2배가 되어(배속이 절반) 체감 속도가 같게 유지된다", () => {
    expect(fallTimeMsForBpm(150, 300, 800)).toBe(1600);
  });

  it("같은 그린넘버라도 BPM이 절반이면 낙하 시간도 절반이 된다", () => {
    expect(fallTimeMsForBpm(150, 75, 800)).toBe(400);
  });

  it("BPM이 0 이하면 baseGreenNumberMs로 폴백한다", () => {
    expect(fallTimeMsForBpm(150, 0, 800)).toBe(800);
  });
});

describe("clampGreenNumber", () => {
  it("GREEN_NUMBER_STEP(5) 단위로 반올림한다", () => {
    expect(clampGreenNumber(151)).toBe(150);
    expect(clampGreenNumber(153)).toBe(155);
  });

  it("GREEN_NUMBER_MIN 미만은 GREEN_NUMBER_MIN으로 clamp된다", () => {
    expect(clampGreenNumber(1)).toBe(50);
  });

  it("GREEN_NUMBER_MAX 초과는 GREEN_NUMBER_MAX로 clamp된다", () => {
    expect(clampGreenNumber(9999)).toBe(1500);
  });
});
