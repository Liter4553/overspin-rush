// AudioContext.currentTime을 게임 시간 기준으로 사용하는 클럭.
// rAF의 timestamp나 Date.now()는 게임 클럭으로 쓰지 않는다 (SPEC.md 1절 참고).
export class AudioClock {
  private readonly ctx: AudioContext;
  private startedAt: number | null = null;

  constructor(ctx: AudioContext = new AudioContext()) {
    this.ctx = ctx;
  }

  get audioContext(): AudioContext {
    return this.ctx;
  }

  get isRunning(): boolean {
    return this.startedAt !== null;
  }

  // 브라우저 자동재생 정책 때문에 사용자 제스처 안에서 호출해야 한다.
  async start(): Promise<void> {
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    this.startedAt = this.ctx.currentTime;
  }

  // 클럭 시작 시점 기준 경과 시간(초).
  get currentTime(): number {
    if (this.startedAt === null) return 0;
    return this.ctx.currentTime - this.startedAt;
  }

  // KeyboardEvent.timeStamp(performance.now()과 같은 시간 원점)를
  // currentTime과 같은 도메인(클럭 시작 후 경과초)으로 변환한다.
  // rAF와 무관하게 입력 이벤트 발생 즉시 판정에 쓰기 위한 변환.
  //
  // performance.now()와 AudioContext의 오디오 하드웨어 클럭은 서로 다른 소스라
  // 시작 시점 한 번만 맞춰두면 재생 시간이 길어질수록 드리프트할 수 있다.
  // getOutputTimestamp()는 호출 시점마다 두 도메인의 실시간 대응쌍을 주므로
  // 매 변환마다 이걸로 재보정해 드리프트를 없앤다.
  toGameTime(perfTimeStampMs: number): number {
    if (this.startedAt === null) return 0;
    const timestamp = this.ctx.getOutputTimestamp();
    const contextTime = timestamp.contextTime ?? this.ctx.currentTime;
    const performanceTime = timestamp.performanceTime ?? performance.now();
    const audioTimeOfEvent = contextTime + (perfTimeStampMs - performanceTime) / 1000;
    return audioTimeOfEvent - this.startedAt;
  }
}
