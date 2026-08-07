import "./style.css";
import { AudioClock } from "./core/audioClock";
import { currentBpm } from "./core/scroll";
import { parseChart } from "./chart/parseChart";
import { dummyChartRaw } from "./chart/dummyChart";
import { computeLaneLayout } from "./render/canvas";
import { drawFxNotes, drawJudgeLine, drawLaneBackground, drawNotes } from "./render/noteRenderer";
import { addJudgmentTick, drawJudgmentBar, type JudgmentTick, type TickSource } from "./render/judgmentBar";
import { drawJudgmentText, type LatestJudgment } from "./render/judgmentText";
import { applyAutoMiss, createNoteTracker, findNearestPendingNote, markJudged } from "./core/noteState";
import { applyJudgement, createGameState } from "./core/gameState";
import { computeErrorMs, displaySign, judge } from "./core/judge";
import { resolveLaneFromKey } from "./input/keyboard";
import {
  accumulateMovement,
  applyScratchDirection,
  createScratchAccumulator,
  createScratchDirectionState,
} from "./core/scratchInput";
import { isChartComplete } from "./core/chartCompletion";
import { computeResults } from "./core/results";
import { computeFitScale } from "./render/viewportScale";
import type { NoteLane } from "./chart/types";
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
  JUDGEABLE_LANES,
  NOTE_JUDGMENT_TABLE,
  PAUSE_TRIGGER_KEY,
  RESULTS_SCALE_BOOST,
  RESUME_COUNTDOWN_SECONDS,
  SCRATCH_DIR_RESET_MS,
  SCRATCH_JUDGMENT_TABLE,
  SCRATCH_THRESHOLD,
  VIEWPORT_FIT_MARGIN_PX,
  VIEWPORT_FIT_MAX_SCALE,
  VIEWPORT_FIT_MIN_SCALE,
} from "./config";

const GRADE_ORDER = ["PERFECT_PLUS", "PERFECT", "GREAT", "GOOD", "MISS"] as const;

function gradePanelHtml(idPrefix: string, includeFastSlow: boolean): string {
  const grades = GRADE_ORDER.map(
    (grade) => `
      <div class="grade-stat">
        <span class="grade-label">${grade.replace("_PLUS", "+")}</span>
        <span class="grade-value" id="${idPrefix}-${grade}">0</span>
      </div>`,
  ).join("");
  if (!includeFastSlow) return grades;
  return `${grades}
    <div class="grade-stat">
      <span class="grade-label">FAST</span>
      <span class="grade-value" id="${idPrefix}-fast">0</span>
    </div>
    <div class="grade-stat">
      <span class="grade-label">SLOW</span>
      <span class="grade-value" id="${idPrefix}-slow">0</span>
    </div>`;
}

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <h1>Overspin RUSH</h1>

  <div id="gameplay-view">
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
    <div class="canvas-wrap">
      <canvas id="game-canvas"></canvas>
      <div class="pause-panel" id="pause-panel" hidden>
        <div class="pause-inner">
          <h2>PAUSE</h2>
          <div class="pause-countdown" id="pause-countdown" hidden></div>
          <button id="resume-btn">재개</button>
        </div>
      </div>
    </div>
    <div class="grade-panel" id="grade-panel"></div>
    <button id="start-btn">시작</button>
  </div>

  <div class="results-panel" id="results-panel" hidden>
    <h2>RESULT</h2>
    <div class="results-summary">
      <div class="summary-stat"><span class="summary-label">SCORE</span><span class="summary-value" id="result-score">0</span></div>
      <div class="summary-stat"><span class="summary-label">이론치</span><span class="summary-value" id="result-theoretical">0</span></div>
      <div class="summary-stat"><span class="summary-label">정확도</span><span class="summary-value" id="result-accuracy">0%</span></div>
      <div class="summary-stat"><span class="summary-label">MAX COMBO</span><span class="summary-value" id="result-maxcombo">0</span></div>
    </div>
    <div class="grade-panel" id="result-grade-panel"></div>
    <div class="histogram-label">판정 오차 분포</div>
    <div class="histogram-wrap">
      <span class="histogram-corner histogram-corner-fast">FAST <span id="result-grade-fast">0</span></span>
      <span class="histogram-corner histogram-corner-slow">SLOW <span id="result-grade-slow">0</span></span>
      <div class="histogram" id="result-histogram"></div>
    </div>
    <button id="restart-btn">다시하기</button>
  </div>
`;

const timeDisplay = document.querySelector<HTMLSpanElement>("#time-display")!;
const bpmDisplay = document.querySelector<HTMLSpanElement>("#bpm-display")!;
const comboDisplay = document.querySelector<HTMLSpanElement>("#combo-display")!;
const scoreDisplay = document.querySelector<HTMLSpanElement>("#score-display")!;
const gradePanel = document.querySelector<HTMLDivElement>("#grade-panel")!;
const startBtn = document.querySelector<HTMLButtonElement>("#start-btn")!;
const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas")!;
const ctx = canvas.getContext("2d")!;
const gameplayView = document.querySelector<HTMLDivElement>("#gameplay-view")!;
const pausePanel = document.querySelector<HTMLDivElement>("#pause-panel")!;
const pauseCountdown = document.querySelector<HTMLDivElement>("#pause-countdown")!;
const resumeBtn = document.querySelector<HTMLButtonElement>("#resume-btn")!;
const resultsPanel = document.querySelector<HTMLDivElement>("#results-panel")!;
const resultGradePanel = document.querySelector<HTMLDivElement>("#result-grade-panel")!;
const resultHistogram = document.querySelector<HTMLDivElement>("#result-histogram")!;
const restartBtn = document.querySelector<HTMLButtonElement>("#restart-btn")!;

gradePanel.innerHTML = gradePanelHtml("grade", true);
resultGradePanel.innerHTML = gradePanelHtml("result-grade", false);

const canvasWidth = CANVAS_WIDTH_OPTIONS[DEFAULT_CANVAS_WIDTH_OPTION];
const dpr = window.devicePixelRatio || 1;
canvas.style.width = `${canvasWidth}px`;
canvas.style.height = `${CANVAS_HEIGHT}px`;

const layout = computeLaneLayout(canvasWidth, DEFAULT_SCRATCH_SIDE);
const chart = parseChart(dummyChartRaw);

// 캔버스 비트맵 해상도를 dpr과 화면 맞춤 배율(uiScale) 둘 다 반영해서 설정한다.
// 그래야 #app을 zoom으로 확대해도 캔버스가 흐려지지 않는다.
function setCanvasResolution(uiScale: number): void {
  const effectiveScale = dpr * uiScale;
  canvas.width = Math.round(canvasWidth * effectiveScale);
  canvas.height = Math.round(CANVAS_HEIGHT * effectiveScale);
  ctx.setTransform(effectiveScale, 0, 0, effectiveScale, 0, 0);
}

// 확대 전(zoom=1) 상태에서 자연 크기를 한 번만 측정해둔다. 결과 화면도 이 크기를
// 기준으로 배율을 계산하므로, 결과 화면이 아닌 게임 화면(더 큰 쪽) 기준으로 잰다.
const naturalWidth = app.scrollWidth;
const naturalHeight = app.scrollHeight;

const clock = new AudioClock();
type Phase = "playing" | "paused" | "resuming" | "results";
let phase: Phase = "playing";
let baseFitScale = 1;

function applyZoom(): void {
  // 결과 화면은 콘텐츠가 적어 같은 배율이면 상대적으로 작아 보이므로 추가로 키운다.
  const zoom = phase === "results" ? baseFitScale * RESULTS_SCALE_BOOST : baseFitScale;
  // transform은 레이아웃 박스 크기를 바꾸지 않아 스크롤/중앙정렬이 어긋나므로
  // 레이아웃까지 함께 반영되는 zoom을 쓴다.
  app.style.setProperty("zoom", String(zoom));
  setCanvasResolution(baseFitScale);
}

function fitToViewport(): void {
  const availableWidth = window.innerWidth - VIEWPORT_FIT_MARGIN_PX;
  const availableHeight = window.innerHeight - VIEWPORT_FIT_MARGIN_PX;
  baseFitScale = computeFitScale(
    naturalWidth,
    naturalHeight,
    availableWidth,
    availableHeight,
    VIEWPORT_FIT_MIN_SCALE,
    VIEWPORT_FIT_MAX_SCALE,
  );
  applyZoom();
}

fitToViewport();
window.addEventListener("resize", fitToViewport);

let noteTracker = createNoteTracker(chart);
let gameState = createGameState();
let judgmentTicks: JudgmentTick[] = [];
let latestJudgment: LatestJudgment | null = null;
let scratchAccumulator = createScratchAccumulator();
let scratchDirectionState = createScratchDirectionState();

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
  document.querySelector("#grade-fast")!.textContent = String(gameState.fastCount);
  document.querySelector("#grade-slow")!.textContent = String(gameState.slowCount);
}

function renderHistogram(counts: readonly number[]): void {
  const maxCount = Math.max(1, ...counts);
  resultHistogram.innerHTML = counts
    .map((count, i) => {
      const heightPercent = (count / maxCount) * 100;
      const side = i < counts.length / 2 ? "fast" : "slow";
      return `<div class="hist-bar hist-bar-${side}" style="height:${heightPercent}%" title="${count}건"></div>`;
    })
    .join("");
}

function showResults(): void {
  phase = "results";
  const summary = computeResults(chart, gameState, noteTracker);

  document.querySelector("#result-score")!.textContent = String(summary.score);
  document.querySelector("#result-theoretical")!.textContent = String(summary.theoreticalMax);
  document.querySelector("#result-accuracy")!.textContent = `${summary.accuracyPercent.toFixed(2)}%`;
  document.querySelector("#result-maxcombo")!.textContent = String(summary.maxCombo);
  for (const grade of GRADE_ORDER) {
    document.querySelector(`#result-grade-${grade}`)!.textContent = String(summary.gradeCounts[grade]);
  }
  document.querySelector("#result-grade-fast")!.textContent = String(summary.fastCount);
  document.querySelector("#result-grade-slow")!.textContent = String(summary.slowCount);
  renderHistogram(summary.errorHistogram);

  gameplayView.hidden = true;
  resultsPanel.hidden = false;
  applyZoom();

  // Pointer Lock을 걸어둔 채 결과 화면으로 넘어가면 마우스 커서가 안 보이는
  // 치명적인 문제가 있었다 — 결과 화면에서는 항상 잠금을 풀어준다.
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }
}

// 레인 타입에 따라 다른 판정 테이블을 골라 판정 1건을 처리한다.
// 키보드(A/S/D)와 스크래치 입력이 이 함수 하나를 공유한다.
function judgeAndApply(lane: NoteLane, inputTimeMs: number, source: TickSource): void {
  const table = lane === "scratch" ? SCRATCH_JUDGMENT_TABLE : NOTE_JUDGMENT_TABLE;
  const found = findNearestPendingNote(noteTracker, lane, inputTimeMs, AUTO_MISS_WINDOW_MS);
  if (found === null) return; // 판정 가능한 노트가 없으면 조용히 무시

  const errorMs = computeErrorMs(inputTimeMs, found.note.time, AUDIO_OFFSET_MS, INPUT_OFFSET_MS);
  const result = judge(Math.abs(errorMs), table);
  const sign = displaySign(result.grade, errorMs);

  markJudged(found, result.grade, errorMs);
  gameState = applyJudgement(gameState, result.grade, result.score, sign);
  judgmentTicks = addJudgmentTick(judgmentTicks, {
    errorMs,
    grade: result.grade,
    source,
    createdAtMs: clock.currentTime * 1000,
  });
  latestJudgment = { grade: result.grade, sign, shownAtMs: clock.currentTime * 1000 };
  updateHud();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pauseGame(): Promise<void> {
  if (phase !== "playing") return;
  phase = "paused";
  await clock.pause();
  resumeBtn.hidden = false;
  pauseCountdown.hidden = true;
  pausePanel.hidden = false;
}

// 재개 클릭 -> 카운트다운(뼈대만, 연출/스킵 등은 마일스톤 9에서 다듬는다) -> 실제 재생 재개.
// 카운트다운 동안은 phase가 "resuming"이라 키/스크래치 입력과 자동 MISS가 전부 멈춰있다.
async function resumeGame(): Promise<void> {
  if (phase !== "paused") return;
  phase = "resuming";

  // Pointer Lock 재요청은 클릭이라는 사용자 제스처 컨텍스트를 유지하기 위해
  // 카운트다운(setTimeout) 이전, 즉 첫 await 이전에 호출한다.
  canvas.requestPointerLock();

  resumeBtn.hidden = true;
  pauseCountdown.hidden = false;
  for (let seconds = RESUME_COUNTDOWN_SECONDS; seconds > 0; seconds--) {
    pauseCountdown.textContent = String(seconds);
    await delay(1000);
  }

  phase = "playing";
  pausePanel.hidden = true;
  await clock.resume();
  renderLoop();
}

resumeBtn.addEventListener("click", () => {
  void resumeGame();
});

// ESC 또는 Pointer Lock 해제(Esc로 풀리는 경우 포함) 시 항상 같은 일시정지로 처리한다.
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== canvas) {
    void pauseGame();
  }
});

// 브라우저가 Esc 해제 직후 재잠금 요청을 짧게 쿨다운시키는 경우가 있어
// (재개 시점의 requestPointerLock이 조용히 실패할 수 있음), 플레이 중에는
// 어디를 클릭하든 잠금이 풀려 있으면 즉시 재요청한다. PAUSE를 누르지 않는 한
// 마우스가 계속 스크래치로 인식돼야 한다는 요구사항에 대한 안전망.
document.addEventListener("click", () => {
  if (phase === "playing" && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

// 판정은 keydown 발생 즉시 계산한다 — rAF/프레임 타이밍과 무관 (SPEC.md 1절).
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === PAUSE_TRIGGER_KEY) {
    void pauseGame();
    return;
  }
  if (phase !== "playing") return;
  if (event.repeat) return;
  if (!clock.isRunning) return;

  const lane = resolveLaneFromKey(event.key, DEFAULT_KEYMAP);
  if (lane === null) return;

  const inputTimeMs = clock.toGameTime(event.timeStamp) * 1000;
  judgeAndApply(lane, inputTimeMs, "key");
}

window.addEventListener("keydown", handleKeydown);

// 스크래치는 Pointer Lock 중에만 movementY를 받는다. 누적->임계값->방향 상태
// 머신을 거쳐 유효한 방향 전환일 때만 판정 파이프라인을 태운다.
function handleMouseMove(event: MouseEvent): void {
  if (phase !== "playing") return;
  if (document.pointerLockElement !== canvas) return;

  const accResult = accumulateMovement(scratchAccumulator, event.movementY, SCRATCH_THRESHOLD);
  scratchAccumulator = accResult.state;
  if (accResult.direction === null) return;

  const inputTimeMs = clock.toGameTime(event.timeStamp) * 1000;
  const dirResult = applyScratchDirection(scratchDirectionState, accResult.direction, inputTimeMs, SCRATCH_DIR_RESET_MS);
  scratchDirectionState = dirResult.state;
  if (!dirResult.valid) return; // 무효 입력(같은 방향 연속)은 조용히 무시, 노트 소모 없음

  judgeAndApply("scratch", inputTimeMs, "scratch");
}

document.addEventListener("mousemove", handleMouseMove);

// rAF는 렌더링 전용. 판정 로직에는 절대 쓰지 않는다 — 여기서는 화면 갱신만 담당.
function renderLoop(): void {
  if (phase !== "playing") return; // 일시정지/결과 화면이면 루프를 멈춘다

  const currentTimeMs = clock.currentTime * 1000;

  // 아직 판정이 붙지 않은 레인(FX)은 자동 MISS 대상에서 제외한다.
  const judgeableTracked = noteTracker.filter((t) => JUDGEABLE_LANES.includes(t.note.lane));
  const newlyMissed = applyAutoMiss(judgeableTracked, currentTimeMs, AUTO_MISS_WINDOW_MS);
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

  if (isChartComplete(chart, currentTimeMs, AUTO_MISS_WINDOW_MS)) {
    showResults();
    return;
  }

  requestAnimationFrame(renderLoop);
}

async function startPlay(): Promise<void> {
  noteTracker = createNoteTracker(chart);
  gameState = createGameState();
  judgmentTicks = [];
  latestJudgment = null;
  scratchAccumulator = createScratchAccumulator();
  scratchDirectionState = createScratchDirectionState();
  phase = "playing";
  gameplayView.hidden = false;
  resultsPanel.hidden = true;
  pausePanel.hidden = true;
  applyZoom();
  updateHud();

  // Pointer Lock 요청은 사용자 제스처 컨텍스트를 유지하기 위해 첫 await 이전에 호출한다.
  canvas.requestPointerLock();

  await clock.start();
  renderLoop();
}

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  startBtn.textContent = "실행 중";
  await startPlay();
});

restartBtn.addEventListener("click", async () => {
  await startPlay();
});
