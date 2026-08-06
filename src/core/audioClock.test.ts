import { describe, expect, it } from "vitest";
import { AudioClock } from "./audioClock";

class FakeAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  // getOutputTimestamp가 돌려줄 실시간 대응쌍. 테스트에서 자유롭게 조작한다.
  outputContextTime = 0;
  outputPerformanceTime = 0;

  async resume() {
    this.state = "running";
  }

  getOutputTimestamp() {
    return { contextTime: this.outputContextTime, performanceTime: this.outputPerformanceTime };
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

  it("toGameTime은 getOutputTimestamp의 실시간 대응쌍으로 KeyboardEvent.timeStamp를 변환한다", async () => {
    const ctx = new FakeAudioContext();
    const clock = new AudioClock(ctx as unknown as AudioContext);
    await clock.start(); // startedAt = ctx.currentTime = 0

    // 오디오 시간 1.5s 시점에 performance.now()가 6000ms였다는 실시간 대응쌍
    ctx.outputContextTime = 1.5;
    ctx.outputPerformanceTime = 6000;

    expect(clock.toGameTime(6000)).toBeCloseTo(1.5);
    expect(clock.toGameTime(6300)).toBeCloseTo(1.8); // 300ms 뒤 입력
    expect(clock.toGameTime(5700)).toBeCloseTo(1.2); // 300ms 전 입력
  });

  it("재보정 덕분에 이후 호출에서 대응쌍이 바뀌어도(드리프트 보정) 정확히 변환한다", async () => {
    const ctx = new FakeAudioContext();
    const clock = new AudioClock(ctx as unknown as AudioContext);
    await clock.start();

    ctx.outputContextTime = 1.5;
    ctx.outputPerformanceTime = 6000;
    expect(clock.toGameTime(6000)).toBeCloseTo(1.5);

    // 시간이 흘러 오디오/성능 클럭 사이 대응 관계가 미세하게 달라졌다고 가정
    ctx.outputContextTime = 10.0;
    ctx.outputPerformanceTime = 14510; // 8.51초 경과했지만 오디오는 8.5초만 진행(드리프트 예시)
    expect(clock.toGameTime(14510)).toBeCloseTo(10.0);
  });

  it("시작 전에는 toGameTime이 0을 반환한다", () => {
    const clock = new AudioClock(new FakeAudioContext() as unknown as AudioContext);
    expect(clock.toGameTime(12345)).toBe(0);
  });
});
