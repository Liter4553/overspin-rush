import "./style.css";
import { AudioClock } from "./core/audioClock";
import { currentBpm } from "./core/scroll";
import { parseChart } from "./chart/parseChart";
import { dummyChartRaw } from "./chart/dummyChart";
import { computeLaneLayout } from "./render/canvas";
import { drawFxNotes, drawJudgeLine, drawLaneBackground, drawNotes } from "./render/noteRenderer";
import {
  BASE_GREEN_NUMBER_MS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH_OPTIONS,
  DEFAULT_CANVAS_WIDTH_OPTION,
  DEFAULT_SCRATCH_SIDE,
} from "./config";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <h1>Overspin RUSH</h1>
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
  <canvas id="game-canvas"></canvas>
  <button id="start-btn">시작</button>
`;

const timeDisplay = document.querySelector<HTMLSpanElement>("#time-display")!;
const bpmDisplay = document.querySelector<HTMLSpanElement>("#bpm-display")!;
const startBtn = document.querySelector<HTMLButtonElement>("#start-btn")!;
const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas")!;
const ctx = canvas.getContext("2d")!;

const canvasWidth = CANVAS_WIDTH_OPTIONS[DEFAULT_CANVAS_WIDTH_OPTION];
const dpr = window.devicePixelRatio || 1;
canvas.width = canvasWidth * dpr;
canvas.height = CANVAS_HEIGHT * dpr;
canvas.style.width = `${canvasWidth}px`;
canvas.style.height = `${CANVAS_HEIGHT}px`;
ctx.scale(dpr, dpr);

const layout = computeLaneLayout(canvasWidth, DEFAULT_SCRATCH_SIDE);
const chart = parseChart(dummyChartRaw);

const clock = new AudioClock();

function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const millis = Math.floor((clamped % 1) * 1000);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

// rAF는 렌더링 전용. 판정 로직에는 절대 쓰지 않는다 — 여기서는 화면 갱신만 담당.
function renderLoop(): void {
  const currentTimeMs = clock.currentTime * 1000;

  timeDisplay.textContent = formatTime(clock.currentTime);
  bpmDisplay.textContent = String(currentBpm(chart.bpmChanges, currentTimeMs));

  ctx.clearRect(0, 0, canvasWidth, CANVAS_HEIGHT);
  drawLaneBackground(ctx, layout);
  drawFxNotes(ctx, layout, chart.notes, currentTimeMs, BASE_GREEN_NUMBER_MS);
  drawNotes(ctx, layout, chart.notes, currentTimeMs, BASE_GREEN_NUMBER_MS);
  drawJudgeLine(ctx, layout);

  requestAnimationFrame(renderLoop);
}

startBtn.addEventListener("click", async () => {
  await clock.start();
  startBtn.disabled = true;
  startBtn.textContent = "실행 중";
  renderLoop();
});
