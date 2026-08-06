import "./style.css";
import { AudioClock } from "./core/audioClock";
import { DEFAULT_BPM } from "./config";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <h1>DJ RUSH</h1>
  <div class="clock-panel">
    <div class="stat">
      <span class="stat-label">TIME</span>
      <span class="stat-value" id="time-display">00:00.000</span>
    </div>
    <div class="stat">
      <span class="stat-label">BPM</span>
      <span class="stat-value" id="bpm-display">--</span>
    </div>
  </div>
  <button id="start-btn">시작</button>
`;

const timeDisplay = document.querySelector<HTMLSpanElement>("#time-display")!;
const bpmDisplay = document.querySelector<HTMLSpanElement>("#bpm-display")!;
const startBtn = document.querySelector<HTMLButtonElement>("#start-btn")!;

const clock = new AudioClock();
bpmDisplay.textContent = String(DEFAULT_BPM);

function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const millis = Math.floor((clamped % 1) * 1000);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

// rAF는 렌더링 전용. 판정 로직에는 절대 쓰지 않는다 — 여기서는 표시 갱신만 담당.
function renderLoop(): void {
  timeDisplay.textContent = formatTime(clock.currentTime);
  requestAnimationFrame(renderLoop);
}

startBtn.addEventListener("click", async () => {
  await clock.start();
  startBtn.disabled = true;
  startBtn.textContent = "실행 중";
  renderLoop();
});
