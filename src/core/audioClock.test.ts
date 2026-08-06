import { describe, expect, it } from "vitest";
import { AudioClock } from "./audioClock";

class FakeAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  async resume() {
    this.state = "running";
  }
}

describe("AudioClock", () => {
  it("시작 전에는 경과 시간이 0이다", () => {
    const clock = new AudioClock(new FakeAudioContext() as unknown as AudioContext);
    expect(clock.currentTime).toBe(0);
    expect(clock.isRunning).toBe(false);
  });

  it("시작 이후 경과 시간은 AudioContext.currentTime 기준으로 계산된다", async () => {
    const ctx = new FakeAudioContext();
    const clock = new AudioClock(ctx as unknown as AudioContext);
    await clock.start();
    ctx.currentTime = 1.5;
    expect(clock.currentTime).toBeCloseTo(1.5);
    expect(clock.isRunning).toBe(true);
  });
});
