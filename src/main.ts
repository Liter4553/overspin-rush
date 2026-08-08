import "./style.css";
import { AudioClock } from "./core/audioClock";
import { currentBpm } from "./core/scroll";
import { parseChart } from "./chart/parseChart";
import { dummyChartRaw } from "./chart/dummyChart";
import { computeLaneLayout } from "./render/canvas";
import { drawFxNotes, drawJudgeLine, drawLaneBackground, drawNotes, type NoteColors } from "./render/noteRenderer";
import { addJudgmentTick, drawJudgmentBar, type JudgmentTick, type TickSource } from "./render/judgmentBar";
import { drawComboDisplay, drawJudgmentText, type LatestJudgment } from "./render/judgmentText";
import { applyAutoMiss, createNoteTracker, findNearestPendingNote, markJudged } from "./core/noteState";
import { applyHoldTick, applyJudgement, createGameState } from "./core/gameState";
import { computeErrorMs, displaySign, judge } from "./core/judge";
import { advanceHoldTicks, computeTickIntervalMs, startActiveHold, type ActiveHold } from "./core/holdState";
import { clampSpeed, greenNumberMsToSpeed, speedToGreenNumberMs } from "./core/speedOptions";
import { applyArrangement, type Arrangement } from "./core/laneArrangement";
import {
  applyGaugePlayHoldTick,
  applyGaugePlayJudgement,
  computeGaugeCoefficient,
  createGaugePlayState,
  currentGauge,
  type GaugePlayState,
  wasRelayed,
} from "./core/gauge";
import {
  clampPresetIndex,
  createDefaultSnapshot,
  parseActivePresetIndex,
  parsePresets,
  serializePresets,
  type OptionsSnapshot,
  type PresetSlots,
} from "./core/optionsStorage";
import { resolveLaneFromKey } from "./input/keyboard";
import {
  accumulateMovement,
  applyScratchDirection,
  createScratchAccumulator,
  createScratchDirectionState,
} from "./core/scratchInput";
import { chartDurationMs, isChartComplete } from "./core/chartCompletion";
import { computeResults, countJudgeableNotes, type GradeTimingBreakdown } from "./core/results";
import { computeFitScale } from "./render/viewportScale";
import { DIFFICULTIES, DIFFICULTY_LABEL, SONG_LIST, type Difficulty, type SongEntry } from "./chart/songList";
import type { Chart, NoteLane } from "./chart/types";
import {
  ACTIVE_PRESET_STORAGE_KEY,
  AUDIO_OFFSET_MS,
  AUTO_MISS_WINDOW_MS,
  BASE_GREEN_NUMBER_MS,
  CANVAS_HEIGHT,
  type CanvasWidthOption,
  CANVAS_WIDTH_OPTIONS,
  DEFAULT_CANVAS_WIDTH_OPTION,
  DEFAULT_GAUGE_TYPE,
  DEFAULT_KEYMAP,
  DEFAULT_NOTE_SKIN_ID,
  DEFAULT_SCRATCH_SIDE,
  GAUGE_TYPE_CONFIG,
  type GaugeType,
  GREEN_NUMBER_MAX_MS,
  GREEN_NUMBER_MIN_MS,
  INPUT_OFFSET_MS,
  JUDGEABLE_LANES,
  JUDGE_GRADE_COLORS,
  JUDGE_LINE_MARGIN_BOTTOM,
  JUDGE_LINE_MARGIN_MAX,
  JUDGE_LINE_MARGIN_MIN,
  NOTE_JUDGMENT_TABLE,
  NOTE_SKIN_PALETTES,
  OFFSET_MAX_MS,
  OFFSET_MIN_MS,
  PAUSE_TRIGGER_KEY,
  PRESET_COUNT,
  PRESET_STORAGE_KEY,
  RESULTS_SCALE_BOOST,
  RESUME_COUNTDOWN_SECONDS,
  SCRATCH_DIR_RESET_MS,
  SCRATCH_JUDGMENT_TABLE,
  SCRATCH_THRESHOLD,
  SCRATCH_THRESHOLD_MAX,
  SCRATCH_THRESHOLD_MIN,
  SPEED_DECREASE_KEY,
  SPEED_INCREASE_KEY,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_STEP,
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

  <div id="song-select-view">
    <h2>SELECT</h2>
    <div class="song-list" id="song-list"></div>
    <div class="song-popup" id="song-popup">
      <div class="song-popup-inner">
        <div class="song-popup-jacket" id="song-popup-jacket"></div>
        <div class="song-popup-info">
          <div class="song-popup-title" id="song-popup-title"></div>
          <div class="song-popup-artist" id="song-popup-artist"></div>
          <div class="difficulty-buttons" id="song-popup-difficulty"></div>
          <button type="button" id="song-popup-mirror-toggle" class="mirror-toggle"></button>
        </div>
        <button id="song-popup-start-btn">START</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="options-overlay" hidden>
  <div class="options-panel" id="options-view">
    <h2>옵션</h2>
    <div class="option-row">
      <label>프리셋</label>
      <div class="preset-buttons" id="preset-buttons">
        ${Array.from({ length: PRESET_COUNT }, (_, i) => `<button type="button" class="preset-btn" data-preset-index="${i}">${i + 1}</button>`).join("")}
      </div>
    </div>
    <div class="option-row">
      <label>&nbsp;</label>
      <button type="button" id="option-save-preset">이 프리셋에 저장</button>
    </div>
    <div class="option-row">
      <label for="option-canvas-width">캔버스 폭</label>
      <select id="option-canvas-width">
        <option value="narrow">좁게</option>
        <option value="normal" selected>보통</option>
        <option value="wide">넓게</option>
      </select>
    </div>
    <div class="option-row">
      <label for="option-speed">배속</label>
      <input type="number" id="option-speed" min="${SPEED_MIN}" max="${SPEED_MAX}" step="${SPEED_STEP}" value="1" />
    </div>
    <div class="option-row">
      <label for="option-green-number">그린넘버(ms)</label>
      <input type="number" id="option-green-number" min="${GREEN_NUMBER_MIN_MS}" max="${GREEN_NUMBER_MAX_MS}" value="${BASE_GREEN_NUMBER_MS}" />
    </div>
    <div class="option-row">
      <label for="option-audio-offset">오디오 오프셋(ms)</label>
      <input type="number" id="option-audio-offset" min="${OFFSET_MIN_MS}" max="${OFFSET_MAX_MS}" value="${AUDIO_OFFSET_MS}" />
    </div>
    <div class="option-row">
      <label for="option-input-offset">입력 오프셋(ms)</label>
      <input type="number" id="option-input-offset" min="${OFFSET_MIN_MS}" max="${OFFSET_MAX_MS}" value="${INPUT_OFFSET_MS}" />
    </div>
    <div class="option-row">
      <label for="option-judge-line">판정선 위치(px)</label>
      <input type="number" id="option-judge-line" min="${JUDGE_LINE_MARGIN_MIN}" max="${JUDGE_LINE_MARGIN_MAX}" value="${JUDGE_LINE_MARGIN_BOTTOM}" />
    </div>
    <div class="option-row">
      <label for="option-scratch-threshold">마우스 감도(스크래치 임계값 px)</label>
      <input type="number" id="option-scratch-threshold" min="${SCRATCH_THRESHOLD_MIN}" max="${SCRATCH_THRESHOLD_MAX}" value="${SCRATCH_THRESHOLD}" />
    </div>
    <div class="option-row">
      <label for="option-note-skin">노트 스킨</label>
      <select id="option-note-skin">
        ${NOTE_SKIN_PALETTES.map(
          (palette) =>
            `<option value="${palette.id}"${palette.id === DEFAULT_NOTE_SKIN_ID ? " selected" : ""}>${palette.label}</option>`,
        ).join("")}
      </select>
    </div>
    <div class="option-row">
      <label for="option-gauge-type">게이지</label>
      <select id="option-gauge-type">
        ${(Object.keys(GAUGE_TYPE_CONFIG) as GaugeType[])
          .map(
            (id) =>
              `<option value="${id}"${id === DEFAULT_GAUGE_TYPE ? " selected" : ""}>${GAUGE_TYPE_CONFIG[id].label}</option>`,
          )
          .join("")}
      </select>
    </div>
    <div class="option-row gas-row" id="option-gas-row" hidden>
      <label for="option-gas-enabled">GAS <span class="info-icon" id="gas-info-icon">\u{1F6C8}</span></label>
      <input type="checkbox" id="option-gas-enabled" />
    </div>
    <button type="button" id="options-close-btn">닫기</button>
  </div>
  </div>
  <div class="info-tooltip" id="gas-info-tooltip" hidden></div>

  <div id="gameplay-view" hidden>
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
        <span class="stat-label">SPEED</span>
        <span class="stat-value" id="speed-display">1.00x</span>
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
    <div class="gauge-bar-wrap" id="gauge-bar-wrap">
      <span class="gauge-bar-type" id="gauge-bar-type">NORMAL</span>
      <div class="gauge-bar-track" id="gauge-bar-track">
        <div class="gauge-bar-fill" id="gauge-bar-fill"></div>
      </div>
      <span class="gauge-bar-percent" id="gauge-bar-percent">0%</span>
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
      <div class="timing-chart" id="result-timing-chart"></div>
    </div>
    <div class="results-buttons">
      <button id="restart-btn">다시하기</button>
      <button id="results-song-select-btn">SELECT</button>
    </div>
  </div>
`;

const timeDisplay = document.querySelector<HTMLSpanElement>("#time-display")!;
const bpmDisplay = document.querySelector<HTMLSpanElement>("#bpm-display")!;
const speedDisplay = document.querySelector<HTMLSpanElement>("#speed-display")!;
const comboDisplay = document.querySelector<HTMLSpanElement>("#combo-display")!;
const scoreDisplay = document.querySelector<HTMLSpanElement>("#score-display")!;
const gradePanel = document.querySelector<HTMLDivElement>("#grade-panel")!;
const songSelectView = document.querySelector<HTMLDivElement>("#song-select-view")!;
const songListEl = document.querySelector<HTMLDivElement>("#song-list")!;
const songPopup = document.querySelector<HTMLDivElement>("#song-popup")!;
const songPopupJacket = document.querySelector<HTMLDivElement>("#song-popup-jacket")!;
const songPopupTitle = document.querySelector<HTMLDivElement>("#song-popup-title")!;
const songPopupArtist = document.querySelector<HTMLDivElement>("#song-popup-artist")!;
const songPopupDifficultyEl = document.querySelector<HTMLDivElement>("#song-popup-difficulty")!;
const songPopupMirrorToggle = document.querySelector<HTMLButtonElement>("#song-popup-mirror-toggle")!;
const songPopupStartBtn = document.querySelector<HTMLButtonElement>("#song-popup-start-btn")!;
const optionsOverlay = document.querySelector<HTMLDivElement>("#options-overlay")!;
const optionCanvasWidthSelect = document.querySelector<HTMLSelectElement>("#option-canvas-width")!;
const optionSpeedInput = document.querySelector<HTMLInputElement>("#option-speed")!;
const optionGreenNumberInput = document.querySelector<HTMLInputElement>("#option-green-number")!;
const optionAudioOffsetInput = document.querySelector<HTMLInputElement>("#option-audio-offset")!;
const optionInputOffsetInput = document.querySelector<HTMLInputElement>("#option-input-offset")!;
const optionJudgeLineInput = document.querySelector<HTMLInputElement>("#option-judge-line")!;
const optionScratchThresholdInput = document.querySelector<HTMLInputElement>("#option-scratch-threshold")!;
const optionNoteSkinSelect = document.querySelector<HTMLSelectElement>("#option-note-skin")!;
const optionGaugeTypeSelect = document.querySelector<HTMLSelectElement>("#option-gauge-type")!;
const optionGasRow = document.querySelector<HTMLDivElement>("#option-gas-row")!;
const optionGasEnabledCheckbox = document.querySelector<HTMLInputElement>("#option-gas-enabled")!;
const gasInfoIcon = document.querySelector<HTMLSpanElement>("#gas-info-icon")!;
const gasInfoTooltip = document.querySelector<HTMLDivElement>("#gas-info-tooltip")!;
const presetButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".preset-btn"));
const optionSavePresetBtn = document.querySelector<HTMLButtonElement>("#option-save-preset")!;
const optionsCloseBtn = document.querySelector<HTMLButtonElement>("#options-close-btn")!;
const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas")!;
const ctx = canvas.getContext("2d")!;
const gameplayView = document.querySelector<HTMLDivElement>("#gameplay-view")!;
const gaugeBarWrap = document.querySelector<HTMLDivElement>("#gauge-bar-wrap")!;
const gaugeBarType = document.querySelector<HTMLSpanElement>("#gauge-bar-type")!;
const gaugeBarTrack = document.querySelector<HTMLDivElement>("#gauge-bar-track")!;
const gaugeBarFill = document.querySelector<HTMLDivElement>("#gauge-bar-fill")!;
const gaugeBarPercent = document.querySelector<HTMLSpanElement>("#gauge-bar-percent")!;
const pausePanel = document.querySelector<HTMLDivElement>("#pause-panel")!;
const pauseCountdown = document.querySelector<HTMLDivElement>("#pause-countdown")!;
const resumeBtn = document.querySelector<HTMLButtonElement>("#resume-btn")!;
const resultsPanel = document.querySelector<HTMLDivElement>("#results-panel")!;
const resultGradePanel = document.querySelector<HTMLDivElement>("#result-grade-panel")!;
const resultTimingChart = document.querySelector<HTMLDivElement>("#result-timing-chart")!;
const restartBtn = document.querySelector<HTMLButtonElement>("#restart-btn")!;
const resultsSongSelectBtn = document.querySelector<HTMLButtonElement>("#results-song-select-btn")!;

gradePanel.innerHTML = gradePanelHtml("grade", true);
resultGradePanel.innerHTML = gradePanelHtml("result-grade", false);

// 캔버스 폭은 옵션 화면에서 "시작"을 누르는 시점에 확정된다(applySelectedLayout).
let canvasWidth = CANVAS_WIDTH_OPTIONS[DEFAULT_CANVAS_WIDTH_OPTION];
const dpr = window.devicePixelRatio || 1;
let layout = computeLaneLayout(canvasWidth, DEFAULT_SCRATCH_SIDE, JUDGE_LINE_MARGIN_BOTTOM);
// 선곡 팝업에서 "곡 시작"을 누른 시점에 선택된 곡의 채보로 교체된다.
let chart: Chart = parseChart(dummyChartRaw);
// 실제 플레이에 쓰이는 채보. 원본 chart는 절대 변형하지 않고, 배치 옵션을 적용한
// 새 노트 배열로 매 플레이 시작 시 다시 만든다(SPEC.md 6절).
let activeChart: Chart = chart;

function buildPlayChart(baseChart: Chart, arrangement: Arrangement): Chart {
  return { ...baseChart, notes: applyArrangement(baseChart.notes, arrangement) };
}

// 선택된 캔버스 폭/판정선 위치를 실제 스타일/레이아웃에 반영한다. 옵션 화면 "시작" 클릭 시 호출.
function applySelectedLayout(canvasWidthOption: CanvasWidthOption, judgeLineMarginBottom: number): void {
  canvasWidth = CANVAS_WIDTH_OPTIONS[canvasWidthOption];
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${CANVAS_HEIGHT}px`;
  gaugeBarWrap.style.width = `${canvasWidth}px`;
  layout = computeLaneLayout(canvasWidth, DEFAULT_SCRATCH_SIDE, judgeLineMarginBottom);
}

// 캔버스 비트맵 해상도를 dpr과 화면 맞춤 배율(uiScale) 둘 다 반영해서 설정한다.
// 그래야 #app을 zoom으로 확대해도 캔버스가 흐려지지 않는다.
function setCanvasResolution(uiScale: number): void {
  const effectiveScale = dpr * uiScale;
  canvas.width = Math.round(canvasWidth * effectiveScale);
  canvas.height = Math.round(CANVAS_HEIGHT * effectiveScale);
  ctx.setTransform(effectiveScale, 0, 0, effectiveScale, 0, 0);
}

// 확대 전(zoom=1) 상태에서 게임 화면의 자연 크기를 측정해둔다(결과 화면도 이 크기를
// 기준으로 배율을 계산하므로, 결과 화면이 아닌 게임 화면(더 큰 쪽) 기준으로 잰다).
// 캔버스 폭이 옵션에서 정해지므로, 옵션 "시작" 클릭 직후(게임 화면이 보이는 시점)에만
// 측정 가능하다 — 그 전에는 0으로 두고 fitToViewport가 아무것도 하지 않게 막는다.
let naturalWidth = 0;
let naturalHeight = 0;

const clock = new AudioClock();
type Phase = "idle" | "playing" | "paused" | "resuming" | "results";
// "idle"은 게임 화면 밖(선곡/옵션) 단계. 클릭 시 캔버스에 Pointer Lock을 요청하는
// 안전망 등 "playing" 전용 동작이 오작동하지 않도록 별도 상태로 분리했다.
let phase: Phase = "idle";
let baseFitScale = 1;

// 최상위 화면 전환. 선곡 화면은 자체 고정 크기라 게임 화면의 화면맞춤(zoom)
// 시스템과 무관하다 — applyZoom()이 이 값을 보고 분기한다.
type Screen = "songSelect" | "gameplay";
let screen: Screen = "songSelect";
let selectedSongId: string | null = null;
let selectedDifficulty: Difficulty = "normal";

// exitPointerLock()을 우리가 직접(결과 화면 진입 등) 호출했을 때, 그 뒤에
// "비동기로" 날아오는 pointerlockchange 이벤트를 진짜 잠금 해제(=일시정지
// 트리거)로 오인하지 않게 막는 플래그. 이벤트가 재시작 이후처럼 늦게
// 도착해도(phase가 이미 "playing"으로 바뀐 뒤라도) 정확히 1번만 무시한다.
let ignoreNextUnlock = false;

function applyZoom(): void {
  if (screen === "songSelect") {
    // 선곡 화면은 자체 고정 크기라 게임 화면 화면맞춤 배율과 무관하게 항상 1배로 둔다.
    app.style.setProperty("zoom", "1");
    return;
  }
  // 결과 화면은 콘텐츠가 적어 같은 배율이면 상대적으로 작아 보이므로 추가로 키운다.
  const zoom = phase === "results" ? baseFitScale * RESULTS_SCALE_BOOST : baseFitScale;
  // transform은 레이아웃 박스 크기를 바꾸지 않아 스크롤/중앙정렬이 어긋나므로
  // 레이아웃까지 함께 반영되는 zoom을 쓴다.
  app.style.setProperty("zoom", String(zoom));
  setCanvasResolution(baseFitScale);
}

function fitToViewport(): void {
  if (naturalWidth === 0) return; // 게임 화면이 아직 한 번도 표시되지 않았다(옵션 화면 단계)
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

window.addEventListener("resize", fitToViewport);

let noteTracker = createNoteTracker(activeChart);
let gameState = createGameState();
let judgmentTicks: JudgmentTick[] = [];
let latestJudgment: LatestJudgment | null = null;
let scratchAccumulator = createScratchAccumulator();
let scratchDirectionState = createScratchDirectionState();
// 레인당 활성 홀드는 최대 1개. keyup 시 즉시 삭제되므로("재개되지 않음") 맵에
// 남아 있다는 것 자체가 "지금 눌려서 틱이 발생 중"이라는 뜻이다.
let activeHolds = new Map<NoteLane, ActiveHold>();
// 진짜 상태는 이 값 하나뿐(SPEC.md 6절) — 배속은 이 값을 표시/조작하는 입력 경로일 뿐이다.
let effectiveGreenNumberMs = BASE_GREEN_NUMBER_MS;
// 곡 전체 길이(ms). TIME 표시를 카운트다운으로 보여주기 위해 플레이 시작 시 한 번 계산해둔다.
let songDurationMs = 0;
let selectedArrangement: Arrangement = "normal";
let audioOffsetMs = AUDIO_OFFSET_MS;
let inputOffsetMs = INPUT_OFFSET_MS;
let activeNoteColors: NoteColors = NOTE_SKIN_PALETTES[0];
let scratchThresholdPx = SCRATCH_THRESHOLD;
let activeGaugeType: GaugeType = DEFAULT_GAUGE_TYPE;
let gasEnabled = false;
// 채보 로드 시 1회 산출되는 NORMAL 계수(a)와 현재 게이지 상태. startPlay에서 초기화된다.
let gaugeCoefficientA = 0;
let gaugePlayState: GaugePlayState = createGaugePlayState(DEFAULT_GAUGE_TYPE, false);

function updateSpeedDisplay(): void {
  const speed = greenNumberMsToSpeed(effectiveGreenNumberMs, BASE_GREEN_NUMBER_MS);
  speedDisplay.textContent = `${speed.toFixed(2)}x`;
}

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

// NORMAL은 보더(70%) 통과 여부로 초록/분홍, HARD는 빨강, CHALLENGE는 보라(SPEC.md 8-1절).
// 30% 이하 경고 연출은 구현하지 않는다(확인된 결정).
function gaugeBarColor(gauge: ReturnType<typeof currentGauge>): string {
  if (gauge.type === "hard") return "#EF4444";
  if (gauge.type === "challenge") return "#A78BFA";
  const border = GAUGE_TYPE_CONFIG.normal.border ?? 100;
  return gauge.value >= border ? "#F472B6" : "#4ADE80";
}

// GAS 전환은 플레이당 1번만 일어나므로, 이미 보여줬으면 다시 트리거하지 않는다.
let gasFlipShown = false;

function updateGaugeBar(): void {
  const gauge = currentGauge(gaugePlayState);
  gaugeBarType.textContent = GAUGE_TYPE_CONFIG[gauge.type].label;
  gaugeBarPercent.textContent = `${Math.floor(gauge.value)}%`; // 1% 단위로 버림 표시
  gaugeBarFill.style.width = `${gauge.value}%`;
  gaugeBarFill.style.background = gaugeBarColor(gauge);

  if (wasRelayed(gaugePlayState) && !gasFlipShown) {
    gasFlipShown = true;
    gaugeBarTrack.classList.add("gas-flip");
    setTimeout(() => gaugeBarTrack.classList.remove("gas-flip"), 500);
  }
}

// 판정 종류와 통일된 막대그래프: 가운데 PERFECT+, 좌우로 PERFECT/GREAT/GOOD/MISS가
// 대칭으로 뻗어나간다(중심에 가까울수록 정타에 가까움). 색은 판정 색과 동일하게 맞춘다.
const FAST_SLOW_ORDER = ["MISS", "GOOD", "GREAT", "PERFECT"] as const;

function renderTimingChart(breakdown: GradeTimingBreakdown): void {
  const bars = [
    ...FAST_SLOW_ORDER.map((grade) => ({ grade, count: breakdown.fastCounts[grade] })),
    { grade: "PERFECT_PLUS" as const, count: breakdown.centerCount },
    ...[...FAST_SLOW_ORDER].reverse().map((grade) => ({ grade, count: breakdown.slowCounts[grade] })),
  ];
  const maxCount = Math.max(1, ...bars.map((b) => b.count));

  resultTimingChart.innerHTML = bars
    .map(({ grade, count }) => {
      const heightPercent = (count / maxCount) * 100;
      const color = JUDGE_GRADE_COLORS[grade];
      const label = grade.replace("_PLUS", "+");
      return `
        <div class="timing-bar-col">
          <div class="timing-bar-track">
            <div class="timing-bar" style="height:${heightPercent}%; background:${color}" title="${count}건"></div>
          </div>
          <div class="timing-bar-label" style="color:${color}">${label}</div>
        </div>`;
    })
    .join("");
}

function showResults(): void {
  phase = "results";
  const summary = computeResults(activeChart, gameState, noteTracker);

  document.querySelector("#result-score")!.textContent = String(summary.score);
  document.querySelector("#result-theoretical")!.textContent = String(summary.theoreticalMax);
  document.querySelector("#result-accuracy")!.textContent = `${summary.accuracyPercent.toFixed(2)}%`;
  document.querySelector("#result-maxcombo")!.textContent = String(summary.maxCombo);
  for (const grade of GRADE_ORDER) {
    document.querySelector(`#result-grade-${grade}`)!.textContent = String(summary.gradeCounts[grade]);
  }
  document.querySelector("#result-grade-fast")!.textContent = String(summary.fastCount);
  document.querySelector("#result-grade-slow")!.textContent = String(summary.slowCount);
  renderTimingChart(summary.gradeTimingBreakdown);

  gameplayView.hidden = true;
  resultsPanel.hidden = false;
  applyZoom();

  // Pointer Lock을 걸어둔 채 결과 화면으로 넘어가면 마우스 커서가 안 보이는
  // 치명적인 문제가 있었다 — 결과 화면에서는 항상 잠금을 풀어준다.
  // 이 해제로 인한 pointerlockchange는 일시정지 트리거가 아니므로 무시 표시.
  if (document.pointerLockElement === canvas) {
    ignoreNextUnlock = true;
    document.exitPointerLock();
  }
}

// 레인 타입에 따라 다른 판정 테이블을 골라 판정 1건을 처리한다.
// 키보드(A/S/D)와 스크래치 입력이 이 함수 하나를 공유한다.
function judgeAndApply(lane: NoteLane, inputTimeMs: number, source: TickSource): void {
  const table = lane === "scratch" ? SCRATCH_JUDGMENT_TABLE : NOTE_JUDGMENT_TABLE;
  const found = findNearestPendingNote(noteTracker, lane, inputTimeMs, AUTO_MISS_WINDOW_MS);
  if (found === null) return; // 판정 가능한 노트가 없으면 조용히 무시

  const errorMs = computeErrorMs(inputTimeMs, found.note.time, audioOffsetMs, inputOffsetMs);
  const result = judge(Math.abs(errorMs), table);
  const sign = displaySign(result.grade, errorMs);

  markJudged(found, result.grade, errorMs);
  gameState = applyJudgement(gameState, result.grade, result.score, sign);
  gaugePlayState = applyGaugePlayJudgement(gaugePlayState, result.grade, gaugeCoefficientA);

  // 홀드는 시작 판정 1회뿐(SPEC.md 3절) — 이후 누르고 있는 동안의 틱은 여기서 활성화만
  // 등록해두고, 실제 발생은 renderLoop가 매 프레임 audioClock 시각으로 계산한다.
  if (found.note.type === "hold") {
    const tickIntervalMs = computeTickIntervalMs(
      activeChart.bpmChanges,
      found.note.time,
      found.note.tickIntervalBeats,
      activeChart.holdTickIntervalBeats,
    );
    activeHolds.set(lane, startActiveHold(found.note, tickIntervalMs));
  }

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

  resumeBtn.hidden = true;
  pauseCountdown.hidden = false;
  for (let seconds = RESUME_COUNTDOWN_SECONDS; seconds > 0; seconds--) {
    pauseCountdown.textContent = String(seconds);
    await delay(1000);
  }

  // Pointer Lock 재요청은 카운트다운이 끝난 뒤에 한다. Esc로 막 풀린 직후라면
  // 브라우저가 재잠금을 짧게 쿨다운시키는데, 클릭 직후 바로 요청하면 그
  // 쿨다운에 걸려 조용히 실패하는 경우가 있었다(성공/실패가 번갈아 나타남).
  // 카운트다운 몇 초가 쿨다운보다 길고, "재개" 클릭에서 비롯된 사용자 제스처
  // 유효기간(수 초) 안에는 들어오므로 여기서 요청하는 게 더 안정적이다.
  canvas.requestPointerLock();

  phase = "playing";
  pausePanel.hidden = true;
  await clock.resume();
  renderLoop();
}

resumeBtn.addEventListener("click", () => {
  void resumeGame();
});

// pointerlockchange는 "지금 안 잠겨있다"는 상태 스냅샷일 뿐 방향을 안 알려준다.
// requestPointerLock()이 아직 실패/대기 중이라 애초에 한 번도 안 잠긴 경우까지
// "해제됨"으로 오인해서 시작하자마자 일시정지되는 버그가 있었다. 그래서 실제로
// 잠겨 있다가(true) 풀린(false) 전이일 때만 일시정지 트리거로 취급한다.
let wasPointerLocked = false;

// ESC 또는 Pointer Lock 해제(Esc로 풀리는 경우 포함) 시 항상 같은 일시정지로 처리한다.
// 단, 결과 화면 진입 시 우리가 직접 잠금을 푼 경우(ignoreNextUnlock)는 제외 —
// 그 이벤트가 재시작 이후로 늦게 도착해서 새 세션을 오인 일시정지시키는
// 버그가 있었다.
document.addEventListener("pointerlockchange", () => {
  const isLocked = document.pointerLockElement === canvas;
  const wasLostJustNow = wasPointerLocked && !isLocked;
  wasPointerLocked = isLocked;

  if (!wasLostJustNow) return;

  if (ignoreNextUnlock) {
    ignoreNextUnlock = false;
    return;
  }
  void pauseGame();
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

  if (event.key === SPEED_DECREASE_KEY || event.key === SPEED_INCREASE_KEY) {
    const direction = event.key === SPEED_DECREASE_KEY ? -1 : 1;
    const currentSpeed = greenNumberMsToSpeed(effectiveGreenNumberMs, BASE_GREEN_NUMBER_MS);
    const nextSpeed = clampSpeed(currentSpeed + direction * SPEED_STEP);
    effectiveGreenNumberMs = speedToGreenNumberMs(nextSpeed, BASE_GREEN_NUMBER_MS);
    updateSpeedDisplay();
    return;
  }

  const lane = resolveLaneFromKey(event.key, DEFAULT_KEYMAP);
  if (lane === null) return;

  const inputTimeMs = clock.toGameTime(event.timeStamp) * 1000;
  judgeAndApply(lane, inputTimeMs, "key");
}

window.addEventListener("keydown", handleKeydown);

// 키를 떼는 순간 그 레인의 활성 홀드를 맵에서 제거한다 — 이후 틱은 다시 발생하지
// 않는다(다시 눌러도 이어지지 않음, SPEC.md 3절). MISS 판정은 별도로 없다.
function handleKeyup(event: KeyboardEvent): void {
  const lane = resolveLaneFromKey(event.key, DEFAULT_KEYMAP);
  if (lane === null) return;
  activeHolds.delete(lane);
}

window.addEventListener("keyup", handleKeyup);

// 스크래치는 Pointer Lock 중에만 movementY를 받는다. 누적->임계값->방향 상태
// 머신을 거쳐 유효한 방향 전환일 때만 판정 파이프라인을 태운다.
function handleMouseMove(event: MouseEvent): void {
  if (phase !== "playing") return;
  if (document.pointerLockElement !== canvas) return;

  const accResult = accumulateMovement(scratchAccumulator, event.movementY, scratchThresholdPx);
  scratchAccumulator = accResult.state;
  if (accResult.direction === null) return;

  const inputTimeMs = clock.toGameTime(event.timeStamp) * 1000;
  const dirResult = applyScratchDirection(scratchDirectionState, accResult.direction, inputTimeMs, SCRATCH_DIR_RESET_MS);
  scratchDirectionState = dirResult.state;
  if (!dirResult.valid) return; // 무효 입력(같은 방향 연속)은 조용히 무시, 노트 소모 없음

  judgeAndApply("scratch", inputTimeMs, "scratch");
}

document.addEventListener("mousemove", handleMouseMove);

// 활성 홀드마다 놓친 틱을 캐치업 처리하고, 끝(endTimeMs)을 지난 홀드는 맵에서 정리한다.
function processHoldTicks(currentTimeMs: number): void {
  for (const [lane, hold] of activeHolds) {
    const { hold: nextHold, tickCount, expired } = advanceHoldTicks(hold, currentTimeMs);
    if (expired) {
      activeHolds.delete(lane);
      continue;
    }
    if (tickCount > 0) {
      for (let i = 0; i < tickCount; i++) {
        gameState = applyHoldTick(gameState);
        gaugePlayState = applyGaugePlayHoldTick(gaugePlayState, true, gaugeCoefficientA);
      }
      activeHolds.set(lane, nextHold);
      updateHud();
    }
  }
}

// rAF는 렌더링 전용. 판정 로직에는 절대 쓰지 않는다 — 여기서는 화면 갱신만 담당.
function renderLoop(): void {
  if (phase !== "playing") return; // 일시정지/결과 화면이면 루프를 멈춘다

  const currentTimeMs = clock.currentTime * 1000;

  const judgeableTracked = noteTracker.filter((t) => JUDGEABLE_LANES.includes(t.note.lane));
  const newlyMissed = applyAutoMiss(judgeableTracked, currentTimeMs, AUTO_MISS_WINDOW_MS);
  if (newlyMissed.length > 0) {
    newlyMissed.forEach(() => {
      gameState = applyJudgement(gameState, "MISS", 0, null);
      gaugePlayState = applyGaugePlayJudgement(gaugePlayState, "MISS", gaugeCoefficientA);
    });
    latestJudgment = { grade: "MISS", sign: null, shownAtMs: currentTimeMs };
    updateHud();
  }

  processHoldTicks(currentTimeMs);
  updateGaugeBar();

  // 카운트업 대신 곡이 끝날 때까지 남은 시간을 카운트다운으로 보여준다.
  timeDisplay.textContent = formatTime((songDurationMs - currentTimeMs) / 1000);
  bpmDisplay.textContent = String(currentBpm(activeChart.bpmChanges, currentTimeMs));

  // 홀드는 시작 판정 즉시 state가 "judged"로 바뀌지만, 꼬리(time+duration)가 판정선을
  // 지날 때까지는 계속 그려야 한다 — 몸통이 누르자마자 사라지면 안 된다.
  const pendingNotes = noteTracker
    .filter((t) => t.state === "pending" || (t.note.type === "hold" && currentTimeMs <= t.note.time + (t.note.duration ?? 0)))
    .map((t) => t.note);

  ctx.clearRect(0, 0, canvasWidth, CANVAS_HEIGHT);
  drawLaneBackground(ctx, layout);
  drawFxNotes(ctx, layout, pendingNotes, currentTimeMs, effectiveGreenNumberMs, activeNoteColors);
  drawNotes(ctx, layout, pendingNotes, currentTimeMs, effectiveGreenNumberMs, activeNoteColors);
  drawJudgeLine(ctx, layout);
  drawJudgmentBar(ctx, layout, judgmentTicks, currentTimeMs);
  drawJudgmentText(ctx, layout, latestJudgment, currentTimeMs);
  drawComboDisplay(ctx, layout, gameState.combo);

  if (isChartComplete(activeChart, currentTimeMs, AUTO_MISS_WINDOW_MS)) {
    showResults();
    return;
  }

  requestAnimationFrame(renderLoop);
}

async function startPlay(): Promise<void> {
  activeChart = buildPlayChart(chart, selectedArrangement);
  songDurationMs = chartDurationMs(activeChart, AUTO_MISS_WINDOW_MS);
  noteTracker = createNoteTracker(activeChart);
  gameState = createGameState();
  gaugeCoefficientA = computeGaugeCoefficient(countJudgeableNotes(activeChart));
  gaugePlayState = createGaugePlayState(activeGaugeType, gasEnabled);
  gasFlipShown = false;
  updateGaugeBar();
  judgmentTicks = [];
  latestJudgment = null;
  scratchAccumulator = createScratchAccumulator();
  scratchDirectionState = createScratchDirectionState();
  activeHolds = new Map();
  phase = "playing";
  screen = "gameplay";
  songSelectView.hidden = true;
  optionsOverlay.hidden = true;
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

// 배속 입력이 바뀌면 그린넘버 입력을(그 반대도) 서로 동기화한다 — SPEC.md 6절,
// effectiveGreenNumberMs 하나가 진짜 상태고 나머지는 그걸 보여주는 두 입력 경로.
function syncSpeedFromInput(): void {
  const speed = clampSpeed(Number(optionSpeedInput.value) || SPEED_MIN);
  optionSpeedInput.value = String(speed);
  optionGreenNumberInput.value = String(Math.round(speedToGreenNumberMs(speed, BASE_GREEN_NUMBER_MS)));
}

function syncGreenNumberFromInput(): void {
  const raw = Number(optionGreenNumberInput.value) || BASE_GREEN_NUMBER_MS;
  const greenNumber = Math.min(GREEN_NUMBER_MAX_MS, Math.max(GREEN_NUMBER_MIN_MS, raw));
  optionGreenNumberInput.value = String(Math.round(greenNumber));
  optionSpeedInput.value = String(clampSpeed(greenNumberMsToSpeed(greenNumber, BASE_GREEN_NUMBER_MS)));
}

optionSpeedInput.addEventListener("change", syncSpeedFromInput);
optionGreenNumberInput.addEventListener("change", syncGreenNumberFromInput);

// GAS는 서바이벌형(HARD/CHALLENGE)에서만 의미가 있다. NORMAL을 고르면 숨긴다.
function updateGasRowVisibility(): void {
  const gaugeType = optionGaugeTypeSelect.value as GaugeType;
  optionGasRow.hidden = !GAUGE_TYPE_CONFIG[gaugeType].survival;
}
optionGaugeTypeSelect.addEventListener("change", updateGasRowVisibility);
updateGasRowVisibility();

const GAS_TOOLTIP_TEXT =
  "Gauge Assist System — 표면 게이지가 0%가 되어도 곧바로 중단되지 않고, 병행 계산 중인 NORMAL 게이지 잔량을 이어받아 계속 진행합니다.";
gasInfoTooltip.textContent = GAS_TOOLTIP_TEXT;

// 팝업 위치는 마우스 커서에 종속 — 아이콘 위에서 움직이는 동안 계속 따라간다.
gasInfoIcon.addEventListener("mouseenter", () => {
  gasInfoTooltip.hidden = false;
});
gasInfoIcon.addEventListener("mousemove", (event) => {
  gasInfoTooltip.style.left = `${event.clientX + 14}px`;
  gasInfoTooltip.style.top = `${event.clientY + 14}px`;
});
gasInfoIcon.addEventListener("mouseleave", () => {
  gasInfoTooltip.hidden = true;
});

// 프리셋 3개. 슬롯이 비어있으면(한 번도 저장 안 함) null — 이때는 기본값을 보여준다.
let presetSlots: PresetSlots = parsePresets(localStorage.getItem(PRESET_STORAGE_KEY));
let activePresetIndex = parseActivePresetIndex(localStorage.getItem(ACTIVE_PRESET_STORAGE_KEY));

function readOptionsSnapshot(): OptionsSnapshot {
  return {
    canvasWidthOption: optionCanvasWidthSelect.value as CanvasWidthOption,
    effectiveGreenNumberMs: Number(optionGreenNumberInput.value),
    arrangement: selectedArrangement,
    audioOffsetMs: Number(optionAudioOffsetInput.value) || 0,
    inputOffsetMs: Number(optionInputOffsetInput.value) || 0,
    judgeLineMarginBottom: Number(optionJudgeLineInput.value) || JUDGE_LINE_MARGIN_BOTTOM,
    noteSkinId: optionNoteSkinSelect.value,
    scratchThreshold: Number(optionScratchThresholdInput.value) || SCRATCH_THRESHOLD,
    gaugeType: optionGaugeTypeSelect.value as GaugeType,
    gasEnabled: optionGasEnabledCheckbox.checked,
  };
}

function applySnapshotToInputs(snapshot: OptionsSnapshot): void {
  optionCanvasWidthSelect.value = snapshot.canvasWidthOption;
  optionGreenNumberInput.value = String(snapshot.effectiveGreenNumberMs);
  syncGreenNumberFromInput(); // clamp/반올림 + 배속 입력과 동기화
  selectedArrangement = snapshot.arrangement; // 토글 UI는 선곡 팝업에 있음 — 팝업 열 때 동기화(updateMirrorToggleLabel)
  optionAudioOffsetInput.value = String(snapshot.audioOffsetMs);
  optionInputOffsetInput.value = String(snapshot.inputOffsetMs);
  optionJudgeLineInput.value = String(snapshot.judgeLineMarginBottom);
  optionNoteSkinSelect.value = snapshot.noteSkinId;
  optionScratchThresholdInput.value = String(snapshot.scratchThreshold);
  optionGaugeTypeSelect.value = snapshot.gaugeType;
  optionGasEnabledCheckbox.checked = snapshot.gasEnabled;
  updateGasRowVisibility();
}

function highlightActivePreset(): void {
  presetButtons.forEach((btn, i) => btn.classList.toggle("active", i === activePresetIndex));
}

// 프리셋 버튼 클릭 -> 해당 슬롯으로 전환하고 저장된 값(없으면 기본값)을 불러온다.
presetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    activePresetIndex = clampPresetIndex(Number(btn.dataset.presetIndex));
    localStorage.setItem(ACTIVE_PRESET_STORAGE_KEY, String(activePresetIndex));
    applySnapshotToInputs(presetSlots[activePresetIndex] ?? createDefaultSnapshot());
    highlightActivePreset();
  });
});

// 지금 화면에 있는 옵션 값을 현재 선택된 프리셋 슬롯에 저장한다.
optionSavePresetBtn.addEventListener("click", () => {
  presetSlots = presetSlots.map((slot, i) => (i === activePresetIndex ? readOptionsSnapshot() : slot));
  localStorage.setItem(PRESET_STORAGE_KEY, serializePresets(presetSlots));

  const original = optionSavePresetBtn.textContent;
  optionSavePresetBtn.textContent = "저장됨";
  setTimeout(() => {
    optionSavePresetBtn.textContent = original;
  }, 1000);
});

// 페이지 로드 시 마지막으로 선택했던 프리셋을 불러와 옵션 화면에 반영한다.
applySnapshotToInputs(presetSlots[activePresetIndex] ?? createDefaultSnapshot());
highlightActivePreset();

// 옵션 화면의 입력값들을 실제 런타임 상태(레이아웃/속도/오프셋/색상)에 반영한다.
// 옵션 오버레이를 닫을 때 호출된다 — 페이지 로드 시 프리셋을 불러온 직후에도 한 번
// 호출해야, 오버레이를 한 번도 열지 않아도 저장된 프리셋 값이 실제로 적용된다.
function applyOptionsFromInputs(): void {
  const judgeLineMarginBottom = Math.min(
    JUDGE_LINE_MARGIN_MAX,
    Math.max(JUDGE_LINE_MARGIN_MIN, Number(optionJudgeLineInput.value) || JUDGE_LINE_MARGIN_BOTTOM),
  );
  applySelectedLayout(optionCanvasWidthSelect.value as CanvasWidthOption, judgeLineMarginBottom);
  syncSpeedFromInput(); // 입력값을 정규화(clamp/반올림)해서 그린넘버 입력과 최종 일치시킨다.
  effectiveGreenNumberMs = Number(optionGreenNumberInput.value);
  updateSpeedDisplay();

  audioOffsetMs = Math.min(OFFSET_MAX_MS, Math.max(OFFSET_MIN_MS, Number(optionAudioOffsetInput.value) || 0));
  inputOffsetMs = Math.min(OFFSET_MAX_MS, Math.max(OFFSET_MIN_MS, Number(optionInputOffsetInput.value) || 0));
  activeNoteColors =
    NOTE_SKIN_PALETTES.find((palette) => palette.id === optionNoteSkinSelect.value) ?? NOTE_SKIN_PALETTES[0];

  scratchThresholdPx = Math.min(
    SCRATCH_THRESHOLD_MAX,
    Math.max(SCRATCH_THRESHOLD_MIN, Number(optionScratchThresholdInput.value) || SCRATCH_THRESHOLD),
  );

  activeGaugeType = optionGaugeTypeSelect.value as GaugeType;
  gasEnabled = optionGasEnabledCheckbox.checked;
}

function openOptionsOverlay(): void {
  optionsOverlay.hidden = false;
}

function closeOptionsOverlay(): void {
  applyOptionsFromInputs();
  optionsOverlay.hidden = true;
}

optionsCloseBtn.addEventListener("click", closeOptionsOverlay);

// 오버레이 바깥(어두운 배경)을 클릭해도 닫힌다.
optionsOverlay.addEventListener("click", (event) => {
  if (event.target === optionsOverlay) closeOptionsOverlay();
});

// 선곡 화면에서 스페이스바를 누르면 옵션이 뜨고, 다시 누르면 닫힌다(SPEC.md 6절).
window.addEventListener("keydown", (event) => {
  if (screen !== "songSelect") return;
  if (event.key !== " ") return;
  event.preventDefault();
  if (optionsOverlay.hidden) openOptionsOverlay();
  else closeOptionsOverlay();
});

// --- 선곡 화면 ---

function findSong(id: string): SongEntry {
  const song = SONG_LIST.find((s) => s.id === id);
  if (song === undefined) throw new Error(`선곡 목록에 없는 곡 id: ${id}`);
  return song;
}

function jacketGradient(song: SongEntry): string {
  return `linear-gradient(135deg, ${song.jacketColors[0]}, ${song.jacketColors[1]})`;
}

// 지금 팝업이 열려 있는 곡의, 지금 선택된 난이도 블록만 진하게 강조한다.
function isActiveLevelBlock(songId: string, difficulty: Difficulty): boolean {
  return songId === selectedSongId && difficulty === selectedDifficulty;
}

function renderSongList(): void {
  songListEl.innerHTML = SONG_LIST.map(
    (song) => `
      <button type="button" class="song-item" data-song-id="${song.id}">
        <div class="song-item-jacket" style="background:${jacketGradient(song)}"></div>
        <div class="song-item-meta">
          <div class="song-item-title">${song.title}</div>
          <div class="song-item-artist">${song.artist}</div>
        </div>
        <div class="song-item-levels">
          ${DIFFICULTIES.map(
            (d) =>
              `<div class="level-block level-${d}${isActiveLevelBlock(song.id, d) ? " active" : ""}" data-difficulty="${d}"><span class="level-block-label">${DIFFICULTY_LABEL[d]}</span><span class="level-block-value">${song.levels[d]}</span></div>`,
          ).join("")}
        </div>
      </button>`,
  ).join("");
}

function renderPopupDifficultyButtons(song: SongEntry): void {
  songPopupDifficultyEl.innerHTML = DIFFICULTIES.map(
    (d) =>
      `<button type="button" class="difficulty-btn diff-${d}${d === selectedDifficulty ? " active" : ""}" data-difficulty="${d}">${DIFFICULTY_LABEL[d]} ${song.levels[d]}</button>`,
  ).join("");
}

// 미러 옵션 토글(팝업). "정배/미러"보다 포괄적으로 읽히도록 ON/OFF 표기로 통일.
const MIRROR_LABEL: Readonly<Record<Arrangement, string>> = { normal: "MIRROR OFF", mirror: "MIRROR ON" };

function updateMirrorToggleLabel(): void {
  songPopupMirrorToggle.textContent = MIRROR_LABEL[selectedArrangement];
  songPopupMirrorToggle.classList.toggle("active", selectedArrangement === "mirror");
}

songPopupMirrorToggle.addEventListener("click", () => {
  selectedArrangement = selectedArrangement === "normal" ? "mirror" : "normal";
  updateMirrorToggleLabel();
});

function openSongPopup(songId: string): void {
  selectedSongId = songId;
  const song = findSong(songId);
  songPopupJacket.style.background = jacketGradient(song);
  songPopupTitle.textContent = song.title;
  songPopupArtist.textContent = song.artist;
  renderPopupDifficultyButtons(song);
  updateMirrorToggleLabel();
  songPopup.classList.add("open");
  renderSongList(); // 리스트 쪽 강조 표시(선택된 곡의 선택된 난이도)를 갱신
}

function closeSongPopup(): void {
  songPopup.classList.remove("open");
  selectedSongId = null;
  renderSongList(); // 팝업이 닫히면 강조도 같이 사라진다
}

// 리스트에서 특정 난이도 블록을 직접 클릭하면 그 난이도가 선택된 채로 팝업이 뜬다.
songListEl.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const itemBtn = target.closest<HTMLButtonElement>(".song-item");
  if (itemBtn === null) return;
  const levelBlock = target.closest<HTMLElement>(".level-block");
  if (levelBlock !== null) {
    selectedDifficulty = levelBlock.dataset.difficulty as Difficulty;
  }
  openSongPopup(itemBtn.dataset.songId!);
});

songPopupDifficultyEl.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const btn = target.closest<HTMLButtonElement>(".difficulty-btn");
  if (btn === null || selectedSongId === null) return;
  selectedDifficulty = btn.dataset.difficulty as Difficulty;
  renderPopupDifficultyButtons(findSong(selectedSongId));
  renderSongList(); // 리스트 쪽 강조도 같이 갱신
});

// Esc를 누르거나 팝업/곡 목록 바깥을 클릭하면 팝업이 닫힌다. 곡 목록 클릭은
// 다른 곡을 고르는 정상 동작이라 닫힘 대상에서 제외한다.
window.addEventListener("keydown", (event) => {
  if (screen !== "songSelect") return;
  if (event.key !== "Escape") return;
  if (!songPopup.classList.contains("open")) return;
  closeSongPopup();
});

document.addEventListener("click", (event) => {
  if (screen !== "songSelect") return;
  if (!songPopup.classList.contains("open")) return;
  // event.target으로 contains()를 검사하면 안 된다 — 난이도 버튼처럼 클릭 시
  // innerHTML을 다시 그리는 요소는 클릭 처리 도중 target이 DOM에서 떨어져나가
  // songPopup.contains(target)가 false로 오판되는 버그가 있었다.
  // composedPath()는 버블링 시작 시점의 경로를 그대로 담고 있어 안전하다.
  const path = event.composedPath();
  if (path.includes(songPopup) || path.includes(songListEl)) return;
  closeSongPopup();
});

// "곡 시작": 선택된 곡의 채보로 교체하고 게임 화면으로 넘어간다. 난이도는 지금은
// 표시/선택만 되고 실제로 다른 채보를 불러오지는 않는다(테스트용 채보 하나뿐 — songList.ts 참고).
songPopupStartBtn.addEventListener("click", async () => {
  if (selectedSongId === null) return;
  songPopupStartBtn.disabled = true;
  songPopupStartBtn.textContent = "실행 중";

  chart = parseChart(findSong(selectedSongId).chartRaw);

  // 게임 화면이 실제로 보이는 지금(zoom=1) 자연 크기를 측정해야 fitToViewport가 정확하다.
  screen = "gameplay";
  songSelectView.hidden = true;
  gameplayView.hidden = false;
  naturalWidth = app.scrollWidth;
  naturalHeight = app.scrollHeight;
  fitToViewport();

  await startPlay();

  songPopupStartBtn.disabled = false;
  songPopupStartBtn.textContent = "곡 시작";
});

function goToSongSelect(): void {
  screen = "songSelect";
  phase = "idle";
  resultsPanel.hidden = true;
  gameplayView.hidden = true;
  songSelectView.hidden = false;
  applyZoom();
}

resultsSongSelectBtn.addEventListener("click", goToSongSelect);

restartBtn.addEventListener("click", async () => {
  await startPlay();
});

renderSongList();
applyOptionsFromInputs(); // 페이지 로드 시 불러온 프리셋 값을 런타임 상태에도 반영
