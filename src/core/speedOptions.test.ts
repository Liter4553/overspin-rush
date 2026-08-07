import { describe, expect, it } from "vitest";
import { clampSpeed, greenNumberMsToSpeed, speedToGreenNumberMs } from "./speedOptions";

describe("speedToGreenNumberMs / greenNumberMsToSpeed", () => {
  it("배속 1.0x는 기준 그린넘버 그대로다", () => {
    expect(speedToGreenNumberMs(1, 800)).toBe(800);
  });

  it("배속이 오르면 그린넘버는 줄어든다(더 빠르게 스크롤)", () => {
    expect(speedToGreenNumberMs(2, 800)).toBe(400);
  });

  it("배속이 내리면 그린넘버는 늘어난다(더 느리게 스크롤)", () => {
    expect(speedToGreenNumberMs(0.5, 800)).toBe(1600);
  });

  it("그린넘버 -> 배속 -> 그린넘버 라운드트립이 원래 값으로 돌아온다", () => {
    const greenNumber = 320;
    const speed = greenNumberMsToSpeed(greenNumber, 800);
    expect(speedToGreenNumberMs(speed, 800)).toBe(greenNumber);
  });
});

describe("clampSpeed", () => {
  it("0.25 단위로 반올림한다", () => {
    expect(clampSpeed(1.1)).toBe(1.0);
    expect(clampSpeed(1.13)).toBe(1.25);
  });

  it("SPEED_MIN 미만은 SPEED_MIN으로 clamp된다", () => {
    expect(clampSpeed(0.1)).toBe(0.5);
  });

  it("SPEED_MAX 초과는 SPEED_MAX로 clamp된다", () => {
    expect(clampSpeed(12)).toBe(10.0);
  });
});
