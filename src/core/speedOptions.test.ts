import { describe, expect, it } from "vitest";
import { clampNoteSpeed, fallTimeMsForNoteSpeed, scaleFallTimeMsForCurrentBpm } from "./speedOptions";

describe("fallTimeMsForNoteSpeed", () => {
  it("노트 속도와 BPM이 같으면 baseGreenNumberMs 그대로다(배속 1.0x)", () => {
    expect(fallTimeMsForNoteSpeed(150, 150, 800)).toBe(800);
  });

  it("노트 속도가 작을수록 낙하 시간이 짧다(더 빠르게 보임)", () => {
    expect(fallTimeMsForNoteSpeed(50, 150, 800)).toBeCloseTo(266.67, 1);
  });

  it("노트 속도가 클수록 낙하 시간이 길다(더 느리게 보임)", () => {
    expect(fallTimeMsForNoteSpeed(300, 150, 800)).toBe(1600);
  });

  it("BPM이 0 이하면 baseGreenNumberMs로 폴백한다", () => {
    expect(fallTimeMsForNoteSpeed(150, 0, 800)).toBe(800);
  });
});

describe("scaleFallTimeMsForCurrentBpm", () => {
  it("현재 BPM이 기준 BPM과 같으면 그대로다", () => {
    expect(scaleFallTimeMsForCurrentBpm(800, 150, 150)).toBe(800);
  });

  it("곡 중간에 BPM이 느려지면(기준보다 낮아지면) 낙하 시간이 늘어난다(스크롤도 느려짐)", () => {
    expect(scaleFallTimeMsForCurrentBpm(800, 150, 75)).toBe(1600);
  });

  it("곡 중간에 BPM이 빨라지면(기준보다 높아지면) 낙하 시간이 줄어든다(스크롤도 빨라짐)", () => {
    expect(scaleFallTimeMsForCurrentBpm(800, 150, 300)).toBe(400);
  });

  it("기준/현재 BPM이 0 이하면 원래 값을 그대로 반환한다(예외 방어)", () => {
    expect(scaleFallTimeMsForCurrentBpm(800, 0, 150)).toBe(800);
    expect(scaleFallTimeMsForCurrentBpm(800, 150, 0)).toBe(800);
  });
});

describe("clampNoteSpeed", () => {
  it("NOTE_SPEED_STEP(5) 단위로 반올림한다", () => {
    expect(clampNoteSpeed(151)).toBe(150);
    expect(clampNoteSpeed(153)).toBe(155);
  });

  it("NOTE_SPEED_MIN 미만은 NOTE_SPEED_MIN으로 clamp된다", () => {
    expect(clampNoteSpeed(1)).toBe(50);
  });

  it("NOTE_SPEED_MAX 초과는 NOTE_SPEED_MAX로 clamp된다", () => {
    expect(clampNoteSpeed(9999)).toBe(1500);
  });
});
