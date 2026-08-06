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
}
