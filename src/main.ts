import "./style.css";
import { AudioClock } from "./core/audioClock";
import { currentBpm } from "./core/scroll";
import { parseChart } from "./chart/parseChart";
import { dummyChartRaw } from "./chart/dummyChart";
import { computeLaneLayout } from "./render/canvas";
import { drawFxNotes, drawJudgeLine, drawLaneBackground, drawNotes } from "./render/noteRenderer";
import { addJudgmentTick, drawJudgmentBar, type JudgmentTick } from "./render/judgmentBar";
import { drawJudgmentText, type LatestJudgment } from "./render/judgmentText";
import { applyAutoMiss, createNoteTracker, findNearestPendingNote, markJudged } from "./core/noteState";
import { applyJudgement, createGameState } from "./core/gameState";
import { computeErrorMs, displaySign, judge } from "./core/judge";
import { resolveLaneFromKey } from "./input/keyboard";
import {
  AUDIO_OFFSET_MS,
  AUTO_MISS_WINDOW_MS,
  BASE_GREEN_NUMBER_MS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH_OPTIONS,
  DEFAULT_CANVAS_WIDTH_OPTION,
  DEFAULT_KEYMAP,
  DEFAULT_SCRATCH_SIDE,
  INPUT_OFFSET_MS,
  NOTE_JUDGMENT_TABLE,
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
    <div class="stat">
      <span class="stat-label">COMBO</span>
      <span class="stat-value" id="combo-display">0</span>
    </div>
    <div class="stat">
      <span class="stat-label">SCORE</span>
      <span class="stat-value" id="score-display">0</span>
    </div>
  </div>
  <canvas id="game-canvas"></canvas>
  <div class="grade-panel" id="grade-panel"></div>
  <button id="start-btn">시작</button>
`;

const timeDisplay = document.querySelector<HTMLSpanElement>("#time-display")!;
const bpmDisplay = document.querySelector<HTMLSpanElement>("#bpm-display")!;
const comboDisplay = document.querySelector<HTMLSpanElement>("#combo-display")!;
const scoreDisplay = document.querySelector<HTMLSpanElement>("#score-display")!;
const gradePanel = document.querySelector<HTMLDivElement>("#grade-panel")!;
const startBtn = document.querySelector<HTMLButtonElement>("#start-btn")!;
const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas")!;
const ctx = canvas.getContext("2d")!;

const GRADE_ORDER = ["PERFECT_PLUS", "PERFECT", "GREAT", "GOOD", "MISS"] as const;
gradePanel.innerHTML = GRADE_ORDER.map(
  (grade) => `
    <div class="grade-stat">
      <span class="grade-label">${grade.replace("_PLUS", "+")}</span>
      <span class="grade-value" id="grade-${grade}">0</span>
    </div>`,
).join("");
gradePanel.innerHTML += `
  <div class="grade-stat">
    <span class="grade-label">FAST</span>
    <span class="grade-value" id="fast-count">0</span>
  </div>
  <div class="grade-stat">
    <span class="grade-label">SLOW</span>
    <span class="grade-value" id="slow-count">0</span>
  </div>`;

const canvasWidth = CANVAS_WIDTH_OPTIONS[DEFAULT_CANVAS_WIDTH_OPTION];
const dpr = window.devicePixelRatio || 1;
canvas.width = canvasWidth * dpr;
canvas.height = CANVAS_HEIGHT * dpr;
canvas.style.width = `${canvasWidth}px`;
canvas.style.height = `${CANVAS_HEIGHT}px`;
ctx.scale(dpr, dpr);

const layout = computeLaneLayout(canvasWidth, DEFAULT_SCRATCH_SIDE);
const chart = parseChart(dummyChartRaw);
const noteTracker = createNoteTracker(chart);

const clock = new AudioClock();
let gameState = createGameState();
let judgmentTicks: JudgmentTick[] = [];
let latestJudgment: LatestJudgment | null = null;

function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const millis = Math.floor((clamped % 1) * 1000);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function updateHud(): void {
  comboDisplay.textContent = String(gameState.combo);
  scoreDisplay.textContent = String(gameState.score);
  for (const grade of GRADE_ORDER) {
    document.querySelector(`#grade-${grade}`)!.textContent = String(gameState.gradeCounts[grade]);
  }
  document.querySelector("#fast-count")!.textContent = String(gameState.fastCount);
  document.querySelector("#slow-count")!.textContent = String(gameState.slowCount);
}

// 판정은 keydown 발생 즉시 계산한다 — rAF/프레임 타이밍과 무관 (SPEC.md 1절).
function handleKeydown(event: KeyboardEvent): void {
  if (event.repeat) return;
  if (!clock.isRunning) return;

  const lane = resolveLaneFromKey(event.key, DEFAULT_KEYMAP);
  if (lane === null) return;

  const inputTimeMs = clock.toGameTime(event.timeStamp) * 1000;
  const found = findNearestPendingNote(noteTracker, lane, inputTimeMs, AUTO_MISS_WINDOW_MS);
  if (found === null) return; // 판정 가능한 노트가 없으면 조용히 무시

  const errorMs = computeErrorMs(inputTimeMs, found.note.time, AUDIO_OFFSET_MS, INPUT_OFFSET_MS);
  const result = judge(Math.abs(errorMs), NOTE_JUDGMENT_TABLE);
  const sign = displaySign(result.grade, errorMs);

  markJudged(found, result.grade, errorMs);
  gameState = applyJudgement(gameState, result.grade, result.score, sign);
  judgmentTicks = addJudgmentTick(judgmentTicks, {
    errorMs,
    grade: result.grade,
    source: "key",
    createdAtMs: clock.currentTime * 1000,
  });
  latestJudgment = { grade: result.grade, sign, shownAtMs: clock.currentTime * 1000 };
  updateHud();
}

window.addEventListener("keydown", handleKeydown);

// rAF는 렌더링 전용. 판정 로직에는 절대 쓰지 않는다 — 여기서는 화면 갱신만 담당.
function renderLoop(): void {
  const currentTimeMs = clock.currentTime * 1000;

  const newlyMissed = applyAutoMiss(noteTracker, currentTimeMs, AUTO_MISS_WINDOW_MS);
  if (newlyMissed.length > 0) {
    newlyMissed.forEach(() => {
      gameState = applyJudgement(gameState, "MISS", 0, null);
    });
    latestJudgment = { grade: "MISS", sign: null, shownAtMs: currentTimeMs };
    updateHud();
  }

  timeDisplay.textContent = formatTime(clock.currentTime);
  bpmDisplay.textContent = String(currentBpm(chart.bpmChanges, currentTimeMs));

  const pendingNotes = noteTracker.filter((t) => t.state === "pending").map((t) => t.note);

  ctx.clearRect(0, 0, canvasWidth, CANVAS_HEIGHT);
  drawLaneBackground(ctx, layout);
  drawFxNotes(ctx, layout, pendingNotes, currentTimeMs, BASE_GREEN_NUMBER_MS);
  drawNotes(ctx, layout, pendingNotes, currentTimeMs, BASE_GREEN_NUMBER_MS);
  drawJudgeLine(ctx, layout);
  drawJudgmentBar(ctx, layout, judgmentTicks, currentTimeMs);
  drawJudgmentText(ctx, layout, latestJudgment, currentTimeMs);

  requestAnimationFrame(renderLoop);
}

startBtn.addEventListener("click", async () => {
  await clock.start();
  startBtn.disabled = true;
  startBtn.textContent = "실행 중";
  renderLoop();
});
