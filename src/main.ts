import "./style.css";
import { AudioClock } from "./core/audioClock";
import { currentBpm } from "./core/scroll";
import { parseChart } from "./chart/parseChart";
import { dummyChartRaw } from "./chart/dummyChart";
import { computeLaneLayout } from "./render/canvas";
import { drawFxNotes, drawJudgeLine, drawLaneBackground, drawNotes, type NoteColors } from "./render/noteRenderer";
import { addJudgmentTick, drawJudgmentBar, type JudgmentTick, type TickSource } from "./render/judgmentBar";
import { drawComboDisplay, drawJudgmentText, type LatestJudgment } from "./render/judgmentText";
import { addHitEffect, createHitEffect, drawHitEffects, pruneExpiredHitEffects, type HitEffect } from "./render/hitEffect";
import { addKeyBeam, drawKeyBeams, pruneExpiredKeyBeams, type KeyBeam } from "./render/keyBeam";
import { applyAutoMiss, createNoteTracker, findNearestPendingNote, markJudged } from "./core/noteState";
import { applyHoldTick, applyJudgement, createGameState } from "./core/gameState";
import { computeErrorMs, displaySign, judge } from "./core/judge";
import { advanceHoldTicks, computeTickIntervalMs, startActiveHold, type ActiveHold } from "./core/holdState";
import { clampNoteSpeed, fallTimeMsForNoteSpeed, scaleFallTimeMsForCurrentBpm } from "./core/speedOptions";
import { applyArrangement, type Arrangement } from "./core/laneArrangement";
import {
  bindingsToKeymap,
  createDefaultKeyBindings,
  MOUSE_BINDING,
  rebindKey,
  SCRATCH_KEY_SLOTS,
  type BindableSlot,
  type KeyBindings,
  type ScratchKeySlot,
} from "./core/keymapOptions";
import {
  applyGaugePlayHoldTick,
  applyGaugePlayJudgement,
  computeGaugeCoefficient,
  createGaugePlayState,
  currentGauge,
  type GaugePlayState,
  wasRelayed,
} from "./core/gauge";
import { computeClearGrade, type ClearGrade } from "./core/clearGrade";
import {
  bestGradeForSong,
  clearRecordKey,
  parseClearRecords,
  serializeClearRecords,
  upsertBestGrade,
  type ClearRecords,
} from "./core/clearRecords";
import {
  highScoreKey,
  parseHighScores,
  serializeHighScores,
  upsertHighScore,
  type HighScores,
} from "./core/highScores";
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
  type ScratchDirection,
} from "./core/scratchInput";
import { chartDurationMs, isChartComplete } from "./core/chartCompletion";
import { computeResults, countJudgeableNotes, type GradeTimingBreakdown } from "./core/results";
import { computeFitScale } from "./render/viewportScale";
import { DIFFICULTIES, DIFFICULTY_LABEL, SONG_LIST, type Difficulty, type SongEntry } from "./chart/songList";
import { loadImportedSongEntries } from "./import/importedSongEntries";
import { deleteImportedSong } from "./import/songStorage";
import { importSongFromZip } from "./import/importSong";
import {
  generateCalibrationBeatScheduleMs,
  suggestAudioOffsetMs,
  suggestInputOffsetMs,
  summarizeCalibrationTest,
  type CalibrationTestResult,
} from "./core/calibration";
import { calibrationIndicatorProgress, drawCalibrationBeatIndicator, isCalibrationBeatFlash } from "./render/calibrationVisual";
import type { Chart, NoteLane } from "./chart/types";
import {
  ACTIVE_PRESET_STORAGE_KEY,
  AUDIO_OFFSET_MS,
  AUTO_MISS_WINDOW_MS,
  BASE_GREEN_NUMBER_MS,
  CALIBRATION_BPM,
  DEFAULT_BPM,
  CANVAS_HEIGHT,
  type CanvasWidthOption,
  CANVAS_WIDTH_OPTIONS,
  DEFAULT_CANVAS_WIDTH_OPTION,
  DEFAULT_GAUGE_TYPE,
  DEFAULT_KEYMAP,
  DEFAULT_NOTE_SKIN_ID,
  DEFAULT_NOTE_SPEED,
  CLEAR_RECORDS_STORAGE_KEY,
  DEFAULT_SCRATCH_SIDE,
  FAIL_RESULTS_DELAY_MS,
  FAIL_SHUTTER_DROP_MS,
  FALL_TIME_MAX_MS,
  FALL_TIME_MIN_MS,
  GAUGE_TYPE_CONFIG,
  type GaugeType,
  HIGH_SCORE_STORAGE_KEY,
  INPUT_OFFSET_MS,
  JUDGEABLE_LANES,
  JUDGE_GRADE_COLORS,
  JUDGE_LINE_MARGIN_BOTTOM,
  JUDGE_LINE_MARGIN_MAX,
  JUDGE_LINE_MARGIN_MIN,
  NOTE_JUDGMENT_TABLE,
  NOTE_SKIN_PALETTES,
  NOTE_SPEED_MAX,
  NOTE_SPEED_MIN,
  NOTE_SPEED_STEP,
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
  type ScratchSide,
  SPEED_DECREASE_KEY,
  SPEED_INCREASE_KEY,
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
    <div class="song-import-error" id="song-import-error" hidden></div>
    <input type="file" id="import-zip-input" accept=".zip,application/zip" hidden />
    <div class="song-popup" id="song-popup">
      <div class="song-popup-inner">
        <div class="song-popup-jacket" id="song-popup-jacket"></div>
        <div class="song-popup-info">
          <div class="song-popup-title-row">
            <div class="song-popup-title" id="song-popup-title"></div>
            <span class="song-popup-clear-mark" id="song-popup-clear-mark"></span>
          </div>
          <div class="song-popup-artist" id="song-popup-artist"></div>
          <div class="difficulty-buttons" id="song-popup-difficulty"></div>
          <div class="song-popup-footer-row">
            <button type="button" id="song-popup-mirror-toggle" class="mirror-toggle"></button>
            <div class="song-popup-score-col">
              <span class="song-popup-accuracy-value" id="song-popup-accuracy-value">0.00%</span>
              <span class="song-popup-hiscore-value" id="song-popup-hiscore-value">0</span>
            </div>
          </div>
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
      <label for="option-canvas-width">캔버스 폭</label>
      <select id="option-canvas-width">
        <option value="narrow">좁게</option>
        <option value="normal" selected>보통</option>
        <option value="wide">넓게</option>
      </select>
    </div>
    <div class="option-row">
      <label for="option-note-speed">노트 속도 <span class="info-icon" id="note-speed-info-icon">\u{1F6C8}</span></label>
      <input type="number" id="option-note-speed" min="${NOTE_SPEED_MIN}" max="${NOTE_SPEED_MAX}" step="${NOTE_SPEED_STEP}" value="${DEFAULT_NOTE_SPEED}" />
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
      <label>오프셋 자동 보정</label>
      <button type="button" id="calibration-open-btn">자동 보정 열기</button>
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
      <label>키 설정</label>
      <button type="button" id="keybind-open-btn">키 설정 열기</button>
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
    <div class="options-footer">
      <button type="button" id="option-save-preset">이 프리셋에 저장</button>
      <button type="button" id="options-close-btn">닫기</button>
    </div>
  </div>
  </div>

  <div class="modal-overlay" id="keybind-overlay" hidden>
  <div class="options-panel keybind-panel">
    <h2>키 설정</h2>
    <div class="keybind-layout" id="keybind-layout">
      <div class="keybind-notes-block">
        <div class="keybind-lanes" id="keybind-lanes"></div>
        <div class="keybind-fx-wrap" id="keybind-fx-wrap"></div>
      </div>
      <div class="keybind-scratch-wrap" id="keybind-scratch-wrap"></div>
    </div>
    <div class="keybind-error" id="keybind-error" hidden></div>
    <div class="option-row">
      <label for="option-scratch-side">스크래치를 왼쪽에</label>
      <input type="checkbox" id="option-scratch-side" />
    </div>
    <div class="options-footer">
      <button type="button" id="keybind-close-btn">닫기</button>
    </div>
  </div>
  </div>

  <div class="modal-overlay" id="calibration-overlay" hidden>
  <div class="options-panel calibration-panel">
    <h2>오프셋 자동 보정</h2>
    <div class="calibration-intro" id="calibration-intro">
      <p>스페이스 키로 두 가지 짧은 테스트를 진행합니다.</p>
      <p>1) 소리 없이 화면만 보고 정확한 타이밍에 입력</p>
      <p>2) 쿵짝 드럼 소리를 들으며 박자에 맞춰 입력</p>
      <button type="button" id="calibration-start-btn">시작</button>
    </div>
    <div class="calibration-run" id="calibration-run" hidden>
      <div class="calibration-stage-label" id="calibration-stage-label"></div>
      <canvas id="calibration-canvas" width="200" height="200"></canvas>
      <div class="calibration-countdown" id="calibration-countdown"></div>
    </div>
    <div class="calibration-result" id="calibration-result" hidden>
      <div class="option-row"><label>입력 오프셋</label><span id="calibration-result-input"></span></div>
      <div class="option-row"><label>오디오 오프셋</label><span id="calibration-result-audio"></span></div>
      <div class="calibration-result-warning" id="calibration-result-warning" hidden></div>
    </div>
    <div class="options-footer" id="calibration-footer-result" hidden>
      <button type="button" id="calibration-retry-btn">다시 시도</button>
      <button type="button" id="calibration-apply-btn">적용</button>
    </div>
    <div class="options-footer">
      <button type="button" id="calibration-close-btn">취소</button>
    </div>
  </div>
  </div>
  <div class="info-tooltip" id="gas-info-tooltip" hidden></div>
  <div class="info-tooltip" id="note-speed-info-tooltip" hidden></div>

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
          <button id="pause-restart-btn">다시시작</button>
          <button id="pause-exit-btn" class="pause-exit-btn">나가기</button>
        </div>
      </div>
      <div class="fail-shutter" id="fail-shutter" hidden>
        <span>FAILED</span>
      </div>
    </div>
    <div class="grade-panel" id="grade-panel"></div>
  </div>

  <div class="results-panel" id="results-panel" hidden>
    <h2>RESULT</h2>
    <div class="clear-grade-badge" id="clear-grade-badge"></div>
    <div class="gauge-bar-wrap" id="result-gauge-bar-wrap">
      <span class="gauge-bar-type" id="result-gauge-bar-type">NORMAL</span>
      <div class="gauge-bar-track" id="result-gauge-bar-track">
        <div class="gauge-bar-fill" id="result-gauge-bar-fill"></div>
      </div>
      <span class="gauge-bar-percent" id="result-gauge-bar-percent">0%</span>
    </div>
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
const songImportError = document.querySelector<HTMLDivElement>("#song-import-error")!;
const importZipInput = document.querySelector<HTMLInputElement>("#import-zip-input")!;
const songPopup = document.querySelector<HTMLDivElement>("#song-popup")!;
const songPopupJacket = document.querySelector<HTMLDivElement>("#song-popup-jacket")!;
const songPopupTitle = document.querySelector<HTMLDivElement>("#song-popup-title")!;
const songPopupArtist = document.querySelector<HTMLDivElement>("#song-popup-artist")!;
const songPopupHiScoreValue = document.querySelector<HTMLSpanElement>("#song-popup-hiscore-value")!;
const songPopupAccuracyValue = document.querySelector<HTMLSpanElement>("#song-popup-accuracy-value")!;
const songPopupClearMark = document.querySelector<HTMLSpanElement>("#song-popup-clear-mark")!;
const songPopupDifficultyEl = document.querySelector<HTMLDivElement>("#song-popup-difficulty")!;
const songPopupMirrorToggle = document.querySelector<HTMLButtonElement>("#song-popup-mirror-toggle")!;
const songPopupStartBtn = document.querySelector<HTMLButtonElement>("#song-popup-start-btn")!;
const optionsOverlay = document.querySelector<HTMLDivElement>("#options-overlay")!;
const optionCanvasWidthSelect = document.querySelector<HTMLSelectElement>("#option-canvas-width")!;
const optionNoteSpeedInput = document.querySelector<HTMLInputElement>("#option-note-speed")!;
const noteSpeedInfoIcon = document.querySelector<HTMLSpanElement>("#note-speed-info-icon")!;
const noteSpeedInfoTooltip = document.querySelector<HTMLDivElement>("#note-speed-info-tooltip")!;
const optionAudioOffsetInput = document.querySelector<HTMLInputElement>("#option-audio-offset")!;
const optionInputOffsetInput = document.querySelector<HTMLInputElement>("#option-input-offset")!;
const optionJudgeLineInput = document.querySelector<HTMLInputElement>("#option-judge-line")!;
const optionScratchThresholdInput = document.querySelector<HTMLInputElement>("#option-scratch-threshold")!;
const keybindOpenBtn = document.querySelector<HTMLButtonElement>("#keybind-open-btn")!;
const keybindOverlay = document.querySelector<HTMLDivElement>("#keybind-overlay")!;
const keybindLanesEl = document.querySelector<HTMLDivElement>("#keybind-lanes")!;
const keybindFxWrap = document.querySelector<HTMLDivElement>("#keybind-fx-wrap")!;
const keybindScratchWrap = document.querySelector<HTMLDivElement>("#keybind-scratch-wrap")!;
const keybindLayout = document.querySelector<HTMLDivElement>("#keybind-layout")!;
const keybindError = document.querySelector<HTMLDivElement>("#keybind-error")!;
const keybindCloseBtn = document.querySelector<HTMLButtonElement>("#keybind-close-btn")!;
const calibrationOpenBtn = document.querySelector<HTMLButtonElement>("#calibration-open-btn")!;
const calibrationOverlay = document.querySelector<HTMLDivElement>("#calibration-overlay")!;
const calibrationIntro = document.querySelector<HTMLDivElement>("#calibration-intro")!;
const calibrationStartBtn = document.querySelector<HTMLButtonElement>("#calibration-start-btn")!;
const calibrationRun = document.querySelector<HTMLDivElement>("#calibration-run")!;
const calibrationStageLabel = document.querySelector<HTMLDivElement>("#calibration-stage-label")!;
const calibrationCanvas = document.querySelector<HTMLCanvasElement>("#calibration-canvas")!;
const calibrationCtx = calibrationCanvas.getContext("2d")!;
const calibrationCountdownEl = document.querySelector<HTMLDivElement>("#calibration-countdown")!;
const calibrationResult = document.querySelector<HTMLDivElement>("#calibration-result")!;
const calibrationResultInput = document.querySelector<HTMLSpanElement>("#calibration-result-input")!;
const calibrationResultAudio = document.querySelector<HTMLSpanElement>("#calibration-result-audio")!;
const calibrationResultWarning = document.querySelector<HTMLDivElement>("#calibration-result-warning")!;
const calibrationFooterResult = document.querySelector<HTMLDivElement>("#calibration-footer-result")!;
const calibrationRetryBtn = document.querySelector<HTMLButtonElement>("#calibration-retry-btn")!;
const calibrationApplyBtn = document.querySelector<HTMLButtonElement>("#calibration-apply-btn")!;
const calibrationCloseBtn = document.querySelector<HTMLButtonElement>("#calibration-close-btn")!;
const optionScratchSideCheckbox = document.querySelector<HTMLInputElement>("#option-scratch-side")!;
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
const failShutter = document.querySelector<HTMLDivElement>("#fail-shutter")!;
const pauseCountdown = document.querySelector<HTMLDivElement>("#pause-countdown")!;
const resumeBtn = document.querySelector<HTMLButtonElement>("#resume-btn")!;
const pauseRestartBtn = document.querySelector<HTMLButtonElement>("#pause-restart-btn")!;
const pauseExitBtn = document.querySelector<HTMLButtonElement>("#pause-exit-btn")!;
const resultsPanel = document.querySelector<HTMLDivElement>("#results-panel")!;
const clearGradeBadge = document.querySelector<HTMLDivElement>("#clear-grade-badge")!;
const resultGaugeBarType = document.querySelector<HTMLSpanElement>("#result-gauge-bar-type")!;
const resultGaugeBarFill = document.querySelector<HTMLDivElement>("#result-gauge-bar-fill")!;
const resultGaugeBarPercent = document.querySelector<HTMLSpanElement>("#result-gauge-bar-percent")!;
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
// 선택된 곡의 실제 음원(zip 임포트). 더미 곡처럼 없으면 무음(메트로놈)으로 재생된다.
let currentSongAudioBlob: Blob | undefined;
let currentAudioSource: AudioBufferSourceNode | null = null;
// IndexedDB에서 불러온 임포트 곡 목록. 더미 3곡(SONG_LIST)은 항상 고정, 이 목록은 새로고침/임포트 시 갱신된다.
let importedSongEntries: SongEntry[] = [];
function isImportedSong(id: string): boolean {
  return importedSongEntries.some((s) => s.id === id);
}

// 곡을 길게 누르면(임포트한 곡만) 난이도 블록이 왼쪽으로 밀리며 삭제 버튼이 드러난다.
// 더미 3곡은 삭제 대상이 아니므로 롱프레스 UI 자체가 뜨지 않는다.
const SONG_DELETE_LONG_PRESS_MS = 500;
let armedDeleteSongId: string | null = null;
let longPressTimerId: number | null = null;
let longPressJustArmed = false; // 롱프레스로 삭제 버튼을 연 그 릴리즈의 click 이벤트를 무시하기 위한 플래그

function clearLongPressTimer(): void {
  if (longPressTimerId !== null) {
    window.clearTimeout(longPressTimerId);
    longPressTimerId = null;
  }
}

function disarmDeleteSong(): void {
  if (armedDeleteSongId === null) return;
  armedDeleteSongId = null;
  renderSongList();
}

async function handleDeleteImportedSong(songId: string): Promise<void> {
  armedDeleteSongId = null;
  if (selectedSongId === songId) closeSongPopup();
  await deleteImportedSong(songId);
  await refreshSongList();
}
function allSongs(): SongEntry[] {
  return [...SONG_LIST, ...importedSongEntries];
}
// 실제 플레이에 쓰이는 채보. 원본 chart는 절대 변형하지 않고, 배치 옵션을 적용한
// 새 노트 배열로 매 플레이 시작 시 다시 만든다(SPEC.md 6절).
let activeChart: Chart = chart;

function buildPlayChart(baseChart: Chart, arrangement: Arrangement): Chart {
  return { ...baseChart, notes: applyArrangement(baseChart.notes, arrangement) };
}

// 선택된 캔버스 폭/판정선 위치/스크래치 사이드를 실제 스타일/레이아웃에 반영한다. 옵션 화면 "시작" 클릭 시 호출.
function applySelectedLayout(canvasWidthOption: CanvasWidthOption, judgeLineMarginBottom: number, scratchSide: ScratchSide): void {
  canvasWidth = CANVAS_WIDTH_OPTIONS[canvasWidthOption];
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${CANVAS_HEIGHT}px`;
  gaugeBarWrap.style.width = `${canvasWidth}px`;
  layout = computeLaneLayout(canvasWidth, scratchSide, judgeLineMarginBottom);
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
let hitEffects: HitEffect[] = [];
let keyBeams: KeyBeam[] = [];
let scratchAccumulator = createScratchAccumulator();
let scratchDirectionState = createScratchDirectionState();
// 레인당 활성 홀드는 최대 1개. keyup 시 즉시 삭제되므로("재개되지 않음") 맵에
// 남아 있다는 것 자체가 "지금 눌려서 틱이 발생 중"이라는 뜻이다.
let activeHolds = new Map<NoteLane, ActiveHold>();
// 노트 속도(작을수록 빠름, SPEC.md 6절, 2026-08-11 개정)가 사용자가 조절하는 진짜 상태다.
// 이걸로부터 나온 배속(=낙하 시간)은 곡 시작 시점(또는 실시간 변경 시점)의 BPM 기준으로
// 딱 한 번만 계산해 고정한다 — recalibrateNoteSpeed 참고. 곡 도중 BPM이 바뀌면 이 고정된
// 배속을 다시 계산하지 않고, 바뀐 BPM에 비례해서 그대로 스크롤 속도에 반영한다.
let noteSpeed = DEFAULT_NOTE_SPEED;
let fallTimeMsAtReference = BASE_GREEN_NUMBER_MS;
let referenceBpm = DEFAULT_BPM;

// 지금 노트 속도 값을 bpmNow 기준으로 다시 고정한다. 곡 시작 시(그 곡의 시작 BPM으로)와
// 플레이 중 실시간으로 노트 속도를 바꿀 때(그 순간의 BPM으로) 호출된다.
function recalibrateNoteSpeed(bpmNow: number): void {
  referenceBpm = bpmNow;
  fallTimeMsAtReference = fallTimeMsForNoteSpeed(noteSpeed, bpmNow, BASE_GREEN_NUMBER_MS);
}

// 고정해둔 배속(fallTimeMsAtReference/referenceBpm)에, 지금 BPM이 얼마나 달라졌는지만
// 반영해서 이번 프레임에 실제로 쓸 낙하 시간을 구한다.
function currentFallTimeMs(): number {
  const bpmNow = currentBpm(activeChart.bpmChanges, clock.currentTime * 1000);
  const raw = scaleFallTimeMsForCurrentBpm(fallTimeMsAtReference, referenceBpm, bpmNow);
  return Math.min(FALL_TIME_MAX_MS, Math.max(FALL_TIME_MIN_MS, raw));
}
// 곡 전체 길이(ms). TIME 표시를 카운트다운으로 보여주기 위해 플레이 시작 시 한 번 계산해둔다.
let songDurationMs = 0;
let selectedArrangement: Arrangement = "normal";
let audioOffsetMs = AUDIO_OFFSET_MS;
let inputOffsetMs = INPUT_OFFSET_MS;
let activeNoteColors: NoteColors = NOTE_SKIN_PALETTES[0];
let scratchThresholdPx = SCRATCH_THRESHOLD;
let activeGaugeType: GaugeType = DEFAULT_GAUGE_TYPE;
let gasEnabled = false;
// 키 설정(레인 1/2/3/FX + 스크래치 업/다운). keyBindings가 옵션 UI가 다루는 진짜 상태고,
// keymap은 그중 레인 부분을 resolveLaneFromKey가 바로 쓸 수 있는 형태로 변환한 파생값이다
// (applyOptionsFromInputs에서 갱신). 스크래치 업/다운은 마우스(MOUSE_BINDING)일 수도 있어
// keymap 변환 대상이 아니고, handleKeydown에서 직접 keyBindings를 참조한다.
let keyBindings: KeyBindings = createDefaultKeyBindings(DEFAULT_KEYMAP);
let keymap: Record<string, NoteLane> = bindingsToKeymap(keyBindings);
let awaitingRebindSlot: BindableSlot | null = null;
// 채보 로드 시 1회 산출되는 NORMAL 계수(a)와 현재 게이지 상태. startPlay에서 초기화된다.
let gaugeCoefficientA = 0;
let gaugePlayState: GaugePlayState = createGaugePlayState(DEFAULT_GAUGE_TYPE, false);
const ALL_GAUGE_TYPES = Object.keys(GAUGE_TYPE_CONFIG) as GaugeType[];
let clearRecords: ClearRecords = parseClearRecords(localStorage.getItem(CLEAR_RECORDS_STORAGE_KEY));
let highScores: HighScores = parseHighScores(localStorage.getItem(HIGH_SCORE_STORAGE_KEY));

// SPEED HUD는 이제 사용자가 정하는 값이 아니라, 고정해둔 배속에 지금 BPM 변화를 반영한
// 실제 낙하 시간으로부터 매번 계산되는 결과값이다.
function updateSpeedDisplay(): void {
  const fallTimeMs = currentFallTimeMs();
  const speed = BASE_GREEN_NUMBER_MS / fallTimeMs;
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

// 결과 화면 헤드라인 문구. HARD/CHALLENGE 클리어도 별도 문구 없이 그냥 CLEAR로
// 표시한다 — 어떤 게이지로 클리어했는지는 아래 색상으로만 구분한다.
const CLEAR_GRADE_LABEL: Readonly<Record<ClearGrade, string>> = {
  FAILED: "FAILED",
  CLEAR: "CLEAR",
  HARD_CLEAR: "CLEAR",
  CHALLENGE_CLEAR: "CLEAR",
  FULL_COMBO: "FULL COMBO",
  PERFECT: "PERFECT",
};

// 결과 화면 배지와 선곡 리스트 클리어 마크가 공유하는 색상 기준.
const CLEAR_GRADE_COLOR: Readonly<Record<ClearGrade, string>> = {
  FAILED: "#EF4444",
  CLEAR: "#4ADE80",
  HARD_CLEAR: "#EF4444",
  CHALLENGE_CLEAR: "#A78BFA",
  FULL_COMBO: "#FFFFFF",
  PERFECT: "#FACC15",
};

// 선곡 리스트 난이도 블록은 좁아서 등급 전체를 못 적는다 — 짧은 약자로 표시.
// HARD_CLEAR/CHALLENGE_CLEAR도 "클리어했다"는 사실만 대표로 보여주면 되므로 CLEAR와 같은 표기를 쓴다.
const CLEAR_GRADE_BADGE_TEXT: Readonly<Record<ClearGrade, string>> = {
  FAILED: "F",
  CLEAR: "C",
  HARD_CLEAR: "C",
  CHALLENGE_CLEAR: "C",
  FULL_COMBO: "FC",
  PERFECT: "P",
};

// HARD/CHALLENGE 게이지가 폭사(dead)했을 때만 호출된다(GAS로 구제되면 dead가 절대 true가
// 되지 않는다 — gauge.ts의 relay 전환 로직 참고). 셔터가 다 내려온 뒤 결과 화면으로 넘어간다.
function triggerFailure(): void {
  phase = "results"; // 남은 입력/자동미스 처리를 즉시 막는다(showResults와 동일한 방식)
  stopCurrentAudio();
  failShutter.hidden = false;
  failShutter.classList.add("dropping");

  if (document.pointerLockElement === canvas) {
    ignoreNextUnlock = true;
    document.exitPointerLock();
  }

  setTimeout(showResults, FAIL_SHUTTER_DROP_MS + FAIL_RESULTS_DELAY_MS);
}

function showResults(): void {
  phase = "results";
  stopCurrentAudio();
  const summary = computeResults(activeChart, gameState, noteTracker);

  const finalGauge = currentGauge(gaugePlayState);
  const clearGrade = computeClearGrade(activeChart, gameState, finalGauge);
  clearGradeBadge.textContent = CLEAR_GRADE_LABEL[clearGrade];
  clearGradeBadge.style.color = CLEAR_GRADE_COLOR[clearGrade];
  resultGaugeBarType.textContent = GAUGE_TYPE_CONFIG[finalGauge.type].label;
  resultGaugeBarPercent.textContent = `${Math.floor(finalGauge.value)}%`; // 1% 단위로 버림(HUD와 동일 규칙)
  resultGaugeBarFill.style.width = `${finalGauge.value}%`;
  resultGaugeBarFill.style.background = gaugeBarColor(finalGauge);

  // 기록은 실제로 굴린 게이지 타입(activeGaugeType)을 기준으로 저장한다 — GAS로 전환됐다면
  // finalGauge.type은 이미 "normal"이지만, 플레이어가 시도한 모드는 여전히 HARD/CHALLENGE다.
  if (selectedSongId !== null) {
    clearRecords = upsertBestGrade(
      clearRecords,
      clearRecordKey(selectedSongId, selectedDifficulty, activeGaugeType),
      clearGrade,
    );
    localStorage.setItem(CLEAR_RECORDS_STORAGE_KEY, serializeClearRecords(clearRecords));

    highScores = upsertHighScore(highScores, highScoreKey(selectedSongId, selectedDifficulty), summary.score);
    localStorage.setItem(HIGH_SCORE_STORAGE_KEY, serializeHighScores(highScores));
  }

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
  hitEffects = addHitEffect(hitEffects, createHitEffect(lane, result.grade, clock.currentTime * 1000));
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
  pausePanel.classList.add("entering"); // 배경 페이드인 + 패널 팝인(다음 일시정지 때도 재생되도록 resumeGame에서 제거)
}

// 재개 클릭 -> 카운트다운 -> 실제 재생 재개.
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
  pausePanel.classList.remove("entering");
  await clock.resume();
  renderLoop();
}

resumeBtn.addEventListener("click", () => {
  void resumeGame();
});

pauseRestartBtn.addEventListener("click", async () => {
  await startPlay();
});

// 일시정지 화면에서 바로 선곡 화면으로 나간다. Esc/락 해제로 들어온 일시정지라
// Pointer Lock은 이미 풀려 있는 상태다(pauseGame이 호출되는 두 경로 모두 그렇다).
pauseExitBtn.addEventListener("click", () => {
  pausePanel.hidden = true;
  pausePanel.classList.remove("entering");
  goToSongSelect();
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
// 마우스 움직임이든 스크래치 전용 키(스크래치 업/다운)든, 방향 하나가 정해지고 나면
// 이후 처리(교대 규칙 + 판정)는 완전히 동일하다 — 두 입력 경로가 이 함수 하나를 공유한다.
function applyScratchDirectionEvent(direction: ScratchDirection, inputTimeMs: number): void {
  const dirResult = applyScratchDirection(scratchDirectionState, direction, inputTimeMs, SCRATCH_DIR_RESET_MS);
  scratchDirectionState = dirResult.state;
  if (!dirResult.valid) return; // 무효 입력(같은 방향 연속)은 조용히 무시, 노트 소모 없음

  keyBeams = addKeyBeam(keyBeams, { lane: "scratch", startedAtMs: clock.currentTime * 1000 });
  judgeAndApply("scratch", inputTimeMs, "scratch");
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === PAUSE_TRIGGER_KEY) {
    void pauseGame();
    return;
  }
  if (phase !== "playing") return;
  if (event.repeat) return;
  if (!clock.isRunning) return;

  if (event.key === SPEED_DECREASE_KEY || event.key === SPEED_INCREASE_KEY) {
    // 노트 속도는 작을수록 빠르다 — "감속" 키는 값을 키우고, "가속" 키는 값을 줄인다.
    const direction = event.key === SPEED_DECREASE_KEY ? 1 : -1;
    noteSpeed = clampNoteSpeed(noteSpeed + direction * NOTE_SPEED_STEP);
    optionNoteSpeedInput.value = String(noteSpeed); // 옵션 화면을 다시 열었을 때도 실시간 변경값이 보이도록
    recalibrateNoteSpeed(currentBpm(activeChart.bpmChanges, clock.currentTime * 1000)); // 지금 BPM 기준으로 다시 고정
    updateSpeedDisplay();
    return;
  }

  // 스크래치 업/다운이 마우스가 아니라 실제 키에 배정돼 있으면(컨트롤러/마우스 없는 환경 대비),
  // 눌리는 즉시 하나의 방향 이벤트로 취급한다 — 마우스처럼 누적/임계값이 필요 없는 이산 입력이다.
  const normalizedKey = event.key.toLowerCase();
  if (keyBindings.scratchUp !== MOUSE_BINDING && normalizedKey === keyBindings.scratchUp) {
    applyScratchDirectionEvent("up", clock.toGameTime(event.timeStamp) * 1000);
    return;
  }
  if (keyBindings.scratchDown !== MOUSE_BINDING && normalizedKey === keyBindings.scratchDown) {
    applyScratchDirectionEvent("down", clock.toGameTime(event.timeStamp) * 1000);
    return;
  }

  const lane = resolveLaneFromKey(event.key, keymap);
  if (lane === null) return;

  keyBeams = addKeyBeam(keyBeams, { lane, startedAtMs: clock.currentTime * 1000 });
  const inputTimeMs = clock.toGameTime(event.timeStamp) * 1000;
  judgeAndApply(lane, inputTimeMs, "key");
}

window.addEventListener("keydown", handleKeydown);

// 키를 떼는 순간 그 레인의 활성 홀드를 맵에서 제거한다 — 이후 틱은 다시 발생하지
// 않는다(다시 눌러도 이어지지 않음, SPEC.md 3절). MISS 판정은 별도로 없다.
function handleKeyup(event: KeyboardEvent): void {
  const lane = resolveLaneFromKey(event.key, keymap);
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
  applyScratchDirectionEvent(accResult.direction, inputTimeMs);
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
  // 곡 시작(또는 실시간 변경) 시점에 고정해둔 배속에, 지금 BPM 변화만 그대로 반영한다.
  const fallTimeMs = currentFallTimeMs();
  updateSpeedDisplay();

  // 홀드는 시작 판정 즉시 state가 "judged"로 바뀌지만, 꼬리(time+duration)가 판정선을
  // 지날 때까지는 계속 그려야 한다 — 몸통이 누르자마자 사라지면 안 된다.
  const pendingNotes = noteTracker
    .filter((t) => t.state === "pending" || (t.note.type === "hold" && currentTimeMs <= t.note.time + (t.note.duration ?? 0)))
    .map((t) => t.note);

  ctx.clearRect(0, 0, canvasWidth, CANVAS_HEIGHT);
  drawLaneBackground(ctx, layout);
  drawFxNotes(ctx, layout, pendingNotes, currentTimeMs, fallTimeMs, activeNoteColors);
  drawNotes(ctx, layout, pendingNotes, currentTimeMs, fallTimeMs, activeNoteColors);
  drawJudgeLine(ctx, layout);
  keyBeams = pruneExpiredKeyBeams(keyBeams, currentTimeMs);
  drawKeyBeams(ctx, layout, keyBeams, currentTimeMs, activeNoteColors);
  hitEffects = pruneExpiredHitEffects(hitEffects, currentTimeMs);
  drawHitEffects(ctx, layout, hitEffects, currentTimeMs);
  drawJudgmentBar(ctx, layout, judgmentTicks, currentTimeMs);
  drawJudgmentText(ctx, layout, latestJudgment, currentTimeMs);
  drawComboDisplay(ctx, layout, gameState.combo);

  if (currentGauge(gaugePlayState).dead) {
    triggerFailure();
    return;
  }

  if (isChartComplete(activeChart, currentTimeMs, AUTO_MISS_WINDOW_MS)) {
    showResults();
    return;
  }

  requestAnimationFrame(renderLoop);
}

function stopCurrentAudio(): void {
  if (currentAudioSource === null) return;
  try {
    currentAudioSource.stop();
  } catch {
    // 이미 멈춘 소스에 다시 stop()을 호출하면 예외가 나는데, 곡 종료/실패/재시작 등
    // 여러 경로에서 중복 호출될 수 있어 조용히 무시한다.
  }
  currentAudioSource = null;
}

// chart.offset(ms, SPEC.md 7절 "오디오 시작과 0박 사이 보정")만큼 오디오 앞부분을 건너뛰거나
// (양수) 늦게 시작해서(음수) 게임 클럭 0(clock.start() 시점)이 note.time=0과 맞도록 스케줄한다.
// startedAtCtxTime은 clock.startedAt을 직접 노출하지 않고도 "ctx.currentTime - clock.currentTime"로
// 역산한다 — 호출 시점이 clock.start() 직후가 아니어도(오디오 디코딩 시간만큼 늦어져도) 정확하다.
function scheduleAudioBuffer(audioBuffer: AudioBuffer, offsetMs: number): void {
  const source = clock.audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(clock.audioContext.destination);

  const startedAtCtxTime = clock.audioContext.currentTime - clock.currentTime;
  const now = clock.audioContext.currentTime;
  let startAtCtxTime = startedAtCtxTime + Math.max(0, -offsetMs / 1000);
  let bufferOffsetSec = Math.max(0, offsetMs / 1000);
  if (startAtCtxTime < now) {
    // 디코딩이 오래 걸려 예정 시각을 이미 지났다면, 그만큼 버퍼 오프셋을 더 건너뛰어 맞춘다.
    bufferOffsetSec += now - startAtCtxTime;
    startAtCtxTime = now;
  }
  source.start(startAtCtxTime, bufferOffsetSec);
  currentAudioSource = source;
}

async function startPlay(): Promise<void> {
  stopCurrentAudio();
  const audioBufferPromise = currentSongAudioBlob
    ? currentSongAudioBlob
        .arrayBuffer()
        .then((buf) => clock.audioContext.decodeAudioData(buf))
        .catch((error) => {
          console.error("음원 디코딩에 실패해 무음으로 재생합니다:", error);
          return null;
        })
    : null;

  activeChart = buildPlayChart(chart, selectedArrangement);
  recalibrateNoteSpeed(currentBpm(activeChart.bpmChanges, 0)); // 곡 시작 BPM 기준으로 배속을 한 번 고정
  songDurationMs = chartDurationMs(activeChart, AUTO_MISS_WINDOW_MS);
  noteTracker = createNoteTracker(activeChart);
  gameState = createGameState();
  gaugeCoefficientA = computeGaugeCoefficient(countJudgeableNotes(activeChart));
  gaugePlayState = createGaugePlayState(activeGaugeType, gasEnabled);
  gasFlipShown = false;
  updateGaugeBar();
  judgmentTicks = [];
  latestJudgment = null;
  hitEffects = [];
  keyBeams = [];
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
  pausePanel.classList.remove("entering");
  failShutter.hidden = true;
  failShutter.classList.remove("dropping");
  applyZoom();
  updateHud();

  // Pointer Lock 요청은 사용자 제스처 컨텍스트를 유지하기 위해 첫 await 이전에 호출한다.
  canvas.requestPointerLock();

  await clock.start();
  const audioBuffer = audioBufferPromise ? await audioBufferPromise : null;
  if (audioBuffer !== null) scheduleAudioBuffer(audioBuffer, chart.offset);
  renderLoop();
}

// 노트 속도 입력값을 정규화(step 반올림 + clamp)한다.
function syncNoteSpeedFromInput(): void {
  const raw = Number(optionNoteSpeedInput.value) || DEFAULT_NOTE_SPEED;
  optionNoteSpeedInput.value = String(clampNoteSpeed(raw));
}

optionNoteSpeedInput.addEventListener("change", syncNoteSpeedFromInput);

// 레인은 A/S/D 대신 1/2/3으로 표시한다 — 키보드 배열/언어(쿼티 아닌 배열 등)에 따라
// 문자 라벨이 실제 물리적 위치와 혼동될 수 있어서, 숫자로 통일해 어떤 배열에서도 헷갈리지 않게 한다.
const KEYBIND_LANE_LABEL: Readonly<Record<0 | 1 | 2, string>> = { 0: "1", 1: "2", 2: "3" };
const RESERVED_KEYS: readonly string[] = [PAUSE_TRIGGER_KEY, SPEED_DECREASE_KEY, SPEED_INCREASE_KEY];

function displayKeyLabel(key: string): string {
  if (key === MOUSE_BINDING) return "마우스";
  return key === " " ? "SPACE" : key.toUpperCase();
}

function slotFromDataset(value: string | undefined): BindableSlot | null {
  if (value === "fx" || value === "scratchUp" || value === "scratchDown") return value;
  if (value === "0" || value === "1" || value === "2") return Number(value) as 0 | 1 | 2;
  return null;
}

function keybindButtonHtml(slot: BindableSlot, label: string): string {
  const waiting = awaitingRebindSlot === slot;
  return `<button type="button" class="keybind-btn${waiting ? " waiting" : ""}" data-slot="${slot}">
    <span class="keybind-lane-label">${label}</span>
    <span class="keybind-key-label">${waiting ? "입력 대기…" : displayKeyLabel(keyBindings[slot])}</span>
  </button>`;
}

function updateScratchSideLayout(): void {
  keybindLayout.classList.toggle("scratch-left", optionScratchSideCheckbox.checked);
}

function renderKeybindButtons(): void {
  keybindLanesEl.innerHTML = ([0, 1, 2] as const).map((lane) => keybindButtonHtml(lane, KEYBIND_LANE_LABEL[lane])).join("");
  keybindFxWrap.innerHTML = keybindButtonHtml("fx", "FX");
  keybindScratchWrap.innerHTML = keybindButtonHtml("scratchUp", "↑") + keybindButtonHtml("scratchDown", "↓");
  updateScratchSideLayout();
}

function startAwaitingRebind(slot: BindableSlot): void {
  awaitingRebindSlot = slot;
  keybindError.hidden = true;
  renderKeybindButtons();
}

function finishRebind(slot: BindableSlot, rawKey: string): void {
  awaitingRebindSlot = null;
  const result = rebindKey(keyBindings, slot, rawKey, RESERVED_KEYS);
  if (result.ok) {
    keyBindings = result.bindings;
    keybindError.hidden = true;
  } else {
    keybindError.textContent = result.reason ?? "";
    keybindError.hidden = false;
  }
  renderKeybindButtons();
}

keybindLanesEl.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(".keybind-btn");
  const slot = btn === null ? null : slotFromDataset(btn.dataset.slot);
  if (slot !== null) startAwaitingRebind(slot);
});
keybindFxWrap.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(".keybind-btn");
  if (btn !== null) startAwaitingRebind("fx");
});
keybindScratchWrap.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(".keybind-btn");
  const slot = btn === null ? null : slotFromDataset(btn.dataset.slot);
  if (slot !== null) startAwaitingRebind(slot);
});

// 재배정 대기 중일 때만 다음 keydown 하나를 가로챈다. 다른 keydown 리스너(게임 입력,
// 스페이스바 옵션 토글 등)는 각자 awaitingRebindSlot을 확인해 대기 중엔 반응하지 않는다.
window.addEventListener("keydown", (event) => {
  if (awaitingRebindSlot === null) return;
  event.preventDefault();
  finishRebind(awaitingRebindSlot, event.key);
});

// 스크래치 슬롯 재배정 대기 중에 마우스를 위/아래로 움직이면 "마우스로 인식"을 그 자리에서
// 선택한 것으로 간주한다(원래의 마우스 스크래치 방식으로 되돌리는 유일한 방법이기도 하다).
// 사소한 떨림까지 반응하지 않도록 최소 이동량을 둔다. 레인/FX는 마우스로 배정할 수 없으므로 무시.
window.addEventListener("mousemove", (event) => {
  if (awaitingRebindSlot === null) return;
  if (!SCRATCH_KEY_SLOTS.includes(awaitingRebindSlot as ScratchKeySlot)) return;
  if (Math.abs(event.movementY) < 3) return;
  finishRebind(awaitingRebindSlot, MOUSE_BINDING);
});

keybindOpenBtn.addEventListener("click", () => {
  renderKeybindButtons();
  keybindOverlay.hidden = false;
});

function closeKeybindOverlay(): void {
  awaitingRebindSlot = null;
  keybindOverlay.hidden = true;
}

keybindCloseBtn.addEventListener("click", closeKeybindOverlay);
keybindOverlay.addEventListener("click", (event) => {
  if (event.target === keybindOverlay) closeKeybindOverlay();
});
optionScratchSideCheckbox.addEventListener("change", updateScratchSideLayout);

// --- 오프셋 자동 보정 마법사 (SPEC.md 6절) ---
// 캘리브레이션 전용 키는 리매핑과 무관하게 항상 스페이스로 고정한다(모든 키보드 배열에서
// 위치가 동일해 테스트가 일관됨).
const CALIBRATION_KEY = " ";
const CALIBRATION_BEAT_INTERVAL_MS = 60000 / CALIBRATION_BPM;
const CALIBRATION_COUNTDOWN_STEPS = ["3", "2", "1", "시작!"] as const;
const CALIBRATION_COUNTDOWN_STEP_MS = 500;
const CALIBRATION_BEAT_FLASH_WINDOW_MS = 60;

type CalibrationStage = "visual" | "audio";

let calibrationRunToken = 0; // 재시도/취소 시 진행 중이던 비동기 루프를 무효화하는 토큰
// 오디오 테스트에서 예약해둔(미래 재생 예정 포함) 노드들. AudioScheduledSourceNode.start()로
// 예약한 소리는 JS 루프를 취소해도 스스로 멈추지 않으므로, 팝업을 닫거나 다시 시도할 때
// 여기 담긴 노드를 전부 stop()해서 꺼야 한다.
let calibrationActiveAudioNodes: AudioScheduledSourceNode[] = [];
let calibrationSuggestedInputOffsetMs: number | null = null;
let calibrationSuggestedAudioOffsetMs: number | null = null;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// clock.currentTime(초)과 동일한 원리로, 임의의 게임 시간(ms)에 대응하는
// AudioContext.currentTime을 역산한다(scheduleAudioBuffer와 동일한 방식).
function calibrationCtxTimeForGameMs(clockRef: AudioClock, gameTimeMs: number): number {
  const startedAtCtxTime = clockRef.audioContext.currentTime - clockRef.currentTime;
  return startedAtCtxTime + gameTimeMs / 1000;
}

// 저음 사인파 몸통만으로는 노트북/폰 내장 스피커에서 저음역이 거의 재생되지 않아
// "쿵" 소리가 아예 안 들리는 문제가 있었다(2026-08-13). 몸통 음높이를 올리고,
// 소형 스피커에서도 확실히 지각되는 짧은 고음 클릭(어택)을 얹는다 — 실제 킥 드럼
// 신스에서 흔히 쓰는 기법.
function scheduleCalibrationKick(ctx: AudioContext, atCtxTime: number): AudioScheduledSourceNode[] {
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(220, atCtxTime);
  osc.frequency.exponentialRampToValueAtTime(80, atCtxTime + 0.12);
  oscGain.gain.setValueAtTime(1, atCtxTime);
  oscGain.gain.exponentialRampToValueAtTime(0.001, atCtxTime + 0.18);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(atCtxTime);
  osc.stop(atCtxTime + 0.2);

  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();
  click.type = "square";
  click.frequency.setValueAtTime(900, atCtxTime);
  clickGain.gain.setValueAtTime(0.35, atCtxTime);
  clickGain.gain.exponentialRampToValueAtTime(0.001, atCtxTime + 0.02);
  click.connect(clickGain);
  clickGain.connect(ctx.destination);
  click.start(atCtxTime);
  click.stop(atCtxTime + 0.03);

  return [osc, click];
}

function scheduleCalibrationSnare(ctx: AudioContext, atCtxTime: number): AudioScheduledSourceNode[] {
  const bufferSize = Math.floor(ctx.sampleRate * 0.12);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 1800;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.7, atCtxTime);
  gain.gain.exponentialRampToValueAtTime(0.001, atCtxTime + 0.12);

  noise.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(ctx.destination);
  noise.start(atCtxTime);
  noise.stop(atCtxTime + 0.13);
  return [noise];
}

// 짝수 박(1,3번째...)은 쿵(킥), 홀수 박(2,4번째...)은 짝(스네어) — "쿵짝쿵짝" 패턴.
// 예약된 노드는 calibrationActiveAudioNodes에 담아둬서, 팝업을 도중에 닫아도
// stopCalibrationAudio()로 아직 재생되지 않은/재생 중인 소리를 전부 멈출 수 있게 한다.
function scheduleCalibrationDrumPattern(clockRef: AudioClock, beatScheduleMs: readonly number[]): void {
  const ctx = clockRef.audioContext;
  beatScheduleMs.forEach((beatMs, i) => {
    const atCtxTime = calibrationCtxTimeForGameMs(clockRef, beatMs);
    const nodes = i % 2 === 0 ? scheduleCalibrationKick(ctx, atCtxTime) : scheduleCalibrationSnare(ctx, atCtxTime);
    calibrationActiveAudioNodes.push(...nodes);
  });
}

// 아직 재생되지 않았거나 재생 중인 예약된 노드를 전부 즉시 정지한다. 이미 끝난 노드에
// stop()을 호출해도 안전하지만(No-op), 혹시 모를 예외까지 무시하도록 try/catch로 감싼다.
function stopCalibrationAudio(): void {
  for (const node of calibrationActiveAudioNodes) {
    try {
      node.stop();
    } catch {
      // 이미 정지된 노드 등 — 무시.
    }
  }
  calibrationActiveAudioNodes = [];
}

async function runCalibrationCountdown(token: number): Promise<boolean> {
  for (const step of CALIBRATION_COUNTDOWN_STEPS) {
    if (token !== calibrationRunToken) return false;
    calibrationCountdownEl.textContent = step;
    await wait(CALIBRATION_COUNTDOWN_STEP_MS);
  }
  if (token !== calibrationRunToken) return false;
  calibrationCountdownEl.textContent = "";
  return true;
}

function nearestBeatMs(beatScheduleMs: readonly number[], nowMs: number): number {
  return beatScheduleMs.reduce((a, b) => (Math.abs(b - nowMs) < Math.abs(a - nowMs) ? b : a));
}

async function runCalibrationStage(
  token: number,
  clockRef: AudioClock,
  stage: CalibrationStage,
): Promise<CalibrationTestResult | null> {
  calibrationStageLabel.textContent =
    stage === "visual" ? "1/2 시각 테스트 (소리 없음)" : "2/2 오디오 테스트 (소리 있음)";
  calibrationCtx.clearRect(0, 0, calibrationCanvas.width, calibrationCanvas.height);

  const countdownOk = await runCalibrationCountdown(token);
  if (!countdownOk) return null;

  const stageStartMs = clockRef.currentTime * 1000;
  const beatScheduleMs = generateCalibrationBeatScheduleMs(stageStartMs);
  const stageEndMs = beatScheduleMs[beatScheduleMs.length - 1] + CALIBRATION_BEAT_INTERVAL_MS;

  if (stage === "audio") {
    scheduleCalibrationDrumPattern(clockRef, beatScheduleMs);
  }

  const pressTimesMs: number[] = [];
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.key !== CALIBRATION_KEY) return;
    event.preventDefault();
    pressTimesMs.push(clockRef.toGameTime(event.timeStamp) * 1000);
  };
  window.addEventListener("keydown", onKeyDown);

  await new Promise<void>((resolve) => {
    function frame(): void {
      if (token !== calibrationRunToken) {
        resolve();
        return;
      }
      const nowMs = clockRef.currentTime * 1000;
      // 오디오 테스트에도 동일한 인디케이터를 보여준다(2026-08-13 결정) — "언제 시작하고 몇 번
      // 눌러야 하는지 알 수 없다"는 사용성 문제가 측정 순도보다 우선한다고 판단.
      const nextBeat = beatScheduleMs.find((b) => b >= nowMs) ?? beatScheduleMs[beatScheduleMs.length - 1];
      const progress = calibrationIndicatorProgress(nowMs, nextBeat, CALIBRATION_BEAT_INTERVAL_MS);
      const flash = isCalibrationBeatFlash(nowMs, nearestBeatMs(beatScheduleMs, nowMs), CALIBRATION_BEAT_FLASH_WINDOW_MS);
      drawCalibrationBeatIndicator(calibrationCtx, calibrationCanvas.width, progress, flash);
      // 총 몇 박인지/지금 몇 번째인지 알 수 있도록 카운트다운 자리에 진행 카운터를 이어서 표시한다.
      const beatsReached = Math.min(beatScheduleMs.filter((b) => b <= nowMs).length, beatScheduleMs.length);
      calibrationCountdownEl.textContent = `${beatsReached} / ${beatScheduleMs.length}`;
      if (nowMs >= stageEndMs) {
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });

  window.removeEventListener("keydown", onKeyDown);
  if (token !== calibrationRunToken) return null;

  return summarizeCalibrationTest(pressTimesMs, beatScheduleMs);
}

async function runCalibration(): Promise<void> {
  const token = calibrationRunToken;
  calibrationIntro.hidden = true;
  calibrationResult.hidden = true;
  calibrationFooterResult.hidden = true;
  calibrationRun.hidden = false;

  const calibrationClock = new AudioClock(clock.audioContext);
  await calibrationClock.start();
  if (token !== calibrationRunToken) return;

  const visualResult = await runCalibrationStage(token, calibrationClock, "visual");
  if (token !== calibrationRunToken || visualResult === null) return;
  const suggestedInputOffsetMs = suggestInputOffsetMs(visualResult);

  const audioResult = await runCalibrationStage(token, calibrationClock, "audio");
  if (token !== calibrationRunToken || audioResult === null) return;
  const suggestedAudioOffsetMs = suggestAudioOffsetMs(audioResult, suggestedInputOffsetMs);

  calibrationSuggestedInputOffsetMs = suggestedInputOffsetMs;
  calibrationSuggestedAudioOffsetMs = suggestedAudioOffsetMs;
  showCalibrationResult(visualResult, audioResult, suggestedInputOffsetMs, suggestedAudioOffsetMs);
}

function showCalibrationResult(
  visualResult: CalibrationTestResult,
  audioResult: CalibrationTestResult,
  suggestedInputOffsetMsValue: number,
  suggestedAudioOffsetMsValue: number,
): void {
  calibrationRun.hidden = true;
  calibrationResult.hidden = false;
  calibrationFooterResult.hidden = false;

  const currentInput = Number(optionInputOffsetInput.value) || 0;
  const currentAudio = Number(optionAudioOffsetInput.value) || 0;
  calibrationResultInput.textContent = `현재 ${currentInput}ms → 제안 ${suggestedInputOffsetMsValue}ms`;
  calibrationResultAudio.textContent = `현재 ${currentAudio}ms → 제안 ${suggestedAudioOffsetMsValue}ms`;

  const insufficient = visualResult.insufficientSamples || audioResult.insufficientSamples;
  calibrationResultWarning.hidden = !insufficient;
  if (insufficient) {
    calibrationResultWarning.textContent = `표본이 부족합니다(시각 ${visualResult.matchedCount}/${visualResult.totalBeats}, 오디오 ${audioResult.matchedCount}/${audioResult.totalBeats}). 다시 시도해 주세요.`;
  }
  calibrationApplyBtn.disabled = insufficient;
}

function resetCalibrationOverlay(): void {
  calibrationRunToken++; // 진행 중이던 카운트다운/측정 루프를 다음 체크포인트에서 무효화
  stopCalibrationAudio(); // 오디오 테스트 도중 "다시 시도"를 눌러도 예약된 소리가 계속 나지 않도록
  calibrationIntro.hidden = false;
  calibrationRun.hidden = true;
  calibrationResult.hidden = true;
  calibrationFooterResult.hidden = true;
  calibrationApplyBtn.disabled = false;
  calibrationSuggestedInputOffsetMs = null;
  calibrationSuggestedAudioOffsetMs = null;
}

function closeCalibrationOverlay(): void {
  calibrationRunToken++;
  stopCalibrationAudio(); // 오디오 테스트 도중 팝업을 닫아도 예약된 소리가 계속 나지 않도록
  calibrationOverlay.hidden = true;
}

calibrationOpenBtn.addEventListener("click", () => {
  resetCalibrationOverlay();
  calibrationOverlay.hidden = false;
});

calibrationStartBtn.addEventListener("click", () => {
  void runCalibration();
});

calibrationRetryBtn.addEventListener("click", () => {
  resetCalibrationOverlay();
  void runCalibration();
});

calibrationCloseBtn.addEventListener("click", closeCalibrationOverlay);
calibrationOverlay.addEventListener("click", (event) => {
  if (event.target === calibrationOverlay) closeCalibrationOverlay();
});

calibrationApplyBtn.addEventListener("click", () => {
  if (calibrationSuggestedInputOffsetMs === null || calibrationSuggestedAudioOffsetMs === null) return;
  optionInputOffsetInput.value = String(calibrationSuggestedInputOffsetMs);
  optionAudioOffsetInput.value = String(calibrationSuggestedAudioOffsetMs);
  closeCalibrationOverlay();
});

// GAS는 서바이벌형(HARD/CHALLENGE)에서만 의미가 있다. NORMAL을 고르면 숨긴다.
function updateGasRowVisibility(): void {
  const gaugeType = optionGaugeTypeSelect.value as GaugeType;
  optionGasRow.hidden = !GAUGE_TYPE_CONFIG[gaugeType].survival;
}
optionGaugeTypeSelect.addEventListener("change", updateGasRowVisibility);
updateGasRowVisibility();

const GAS_TOOLTIP_TEXT =
  "Gauge Assist System — 게이지가 0이 되어도 게임을 종료하지 않고 NORMAL게이지로 자동 전환됩니다.";
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

const NOTE_SPEED_TOOLTIP_TEXT =
  "노트가 내려오는 속도를 조절합니다. 50부터 1500까지 설정 가능하고, 숫자가 작을수록 속도가 빠릅니다.";
noteSpeedInfoTooltip.textContent = NOTE_SPEED_TOOLTIP_TEXT;

noteSpeedInfoIcon.addEventListener("mouseenter", () => {
  noteSpeedInfoTooltip.hidden = false;
});
noteSpeedInfoIcon.addEventListener("mousemove", (event) => {
  noteSpeedInfoTooltip.style.left = `${event.clientX + 14}px`;
  noteSpeedInfoTooltip.style.top = `${event.clientY + 14}px`;
});
noteSpeedInfoIcon.addEventListener("mouseleave", () => {
  noteSpeedInfoTooltip.hidden = true;
});

// 프리셋 3개. 슬롯이 비어있으면(한 번도 저장 안 함) null — 이때는 기본값을 보여준다.
let presetSlots: PresetSlots = parsePresets(localStorage.getItem(PRESET_STORAGE_KEY));
let activePresetIndex = parseActivePresetIndex(localStorage.getItem(ACTIVE_PRESET_STORAGE_KEY));

function readOptionsSnapshot(): OptionsSnapshot {
  return {
    canvasWidthOption: optionCanvasWidthSelect.value as CanvasWidthOption,
    noteSpeed: Number(optionNoteSpeedInput.value),
    arrangement: selectedArrangement,
    audioOffsetMs: Number(optionAudioOffsetInput.value) || 0,
    inputOffsetMs: Number(optionInputOffsetInput.value) || 0,
    judgeLineMarginBottom: Number(optionJudgeLineInput.value) || JUDGE_LINE_MARGIN_BOTTOM,
    noteSkinId: optionNoteSkinSelect.value,
    scratchThreshold: Number(optionScratchThresholdInput.value) || SCRATCH_THRESHOLD,
    scratchSide: optionScratchSideCheckbox.checked ? "left" : "right",
    keyBindings: { ...keyBindings },
    gaugeType: optionGaugeTypeSelect.value as GaugeType,
    gasEnabled: optionGasEnabledCheckbox.checked,
  };
}

function applySnapshotToInputs(snapshot: OptionsSnapshot): void {
  optionCanvasWidthSelect.value = snapshot.canvasWidthOption;
  optionNoteSpeedInput.value = String(snapshot.noteSpeed);
  syncNoteSpeedFromInput(); // clamp/반올림
  selectedArrangement = snapshot.arrangement; // 토글 UI는 선곡 팝업에 있음 — 팝업 열 때 동기화(updateMirrorToggleLabel)
  optionAudioOffsetInput.value = String(snapshot.audioOffsetMs);
  optionInputOffsetInput.value = String(snapshot.inputOffsetMs);
  optionJudgeLineInput.value = String(snapshot.judgeLineMarginBottom);
  optionNoteSkinSelect.value = snapshot.noteSkinId;
  optionScratchThresholdInput.value = String(snapshot.scratchThreshold);
  optionScratchSideCheckbox.checked = snapshot.scratchSide === "left";
  keyBindings = { ...snapshot.keyBindings }; // 키 설정은 DOM input이 아니라 이 상태 자체가 원본이다.
  awaitingRebindSlot = null;
  renderKeybindButtons();
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
  applySelectedLayout(
    optionCanvasWidthSelect.value as CanvasWidthOption,
    judgeLineMarginBottom,
    optionScratchSideCheckbox.checked ? "left" : "right",
  );
  syncNoteSpeedFromInput(); // 입력값을 정규화(step 반올림/clamp)한다.
  noteSpeed = Number(optionNoteSpeedInput.value);
  updateSpeedDisplay();

  audioOffsetMs = Math.min(OFFSET_MAX_MS, Math.max(OFFSET_MIN_MS, Number(optionAudioOffsetInput.value) || 0));
  inputOffsetMs = Math.min(OFFSET_MAX_MS, Math.max(OFFSET_MIN_MS, Number(optionInputOffsetInput.value) || 0));
  activeNoteColors =
    NOTE_SKIN_PALETTES.find((palette) => palette.id === optionNoteSkinSelect.value) ?? NOTE_SKIN_PALETTES[0];

  scratchThresholdPx = Math.min(
    SCRATCH_THRESHOLD_MAX,
    Math.max(SCRATCH_THRESHOLD_MIN, Number(optionScratchThresholdInput.value) || SCRATCH_THRESHOLD),
  );

  keymap = bindingsToKeymap(keyBindings);

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
// 키 재배정 대기 중(스페이스바로 FX를 새로 배정하려는 경우 등)에는 옵션 토글로 새지 않게 막는다.
// 오프셋 자동 보정 진행 중에도 스페이스는 캘리브레이션 입력 캡처용이라 여기서 가로채면 안 된다.
window.addEventListener("keydown", (event) => {
  if (screen !== "songSelect") return;
  if (awaitingRebindSlot !== null) return;
  if (!calibrationOverlay.hidden) return;
  if (event.key !== " ") return;
  event.preventDefault();
  if (optionsOverlay.hidden) openOptionsOverlay();
  else closeOptionsOverlay();
});

// --- 선곡 화면 ---

function findSong(id: string): SongEntry {
  const song = allSongs().find((s) => s.id === id);
  if (song === undefined) throw new Error(`선곡 목록에 없는 곡 id: ${id}`);
  return song;
}

function jacketBackgroundCss(song: SongEntry): string {
  return song.jacket.type === "gradient"
    ? `linear-gradient(135deg, ${song.jacket.colors[0]}, ${song.jacket.colors[1]})`
    : `center/cover url('${song.jacket.objectUrl}')`;
}

// 임포트한 곡은 zip에 있던 난이도만 있을 수 있다. preferred가 없으면(예: HARD만
// 있는 곡에서 selectedDifficulty가 EASY) 그 곡에 실제로 존재하는 첫 난이도로 대체한다.
function resolveDifficulty(song: SongEntry, preferred: Difficulty): Difficulty {
  if (song.levels[preferred] !== undefined) return preferred;
  const fallback = DIFFICULTIES.find((d) => song.levels[d] !== undefined);
  if (fallback === undefined) throw new Error(`곡에 사용 가능한 난이도가 없습니다: ${song.id}`);
  return fallback;
}

// 지금 팝업이 열려 있는 곡의, 지금 선택된 난이도 블록만 진하게 강조한다.
function isActiveLevelBlock(songId: string, difficulty: Difficulty): boolean {
  return songId === selectedSongId && difficulty === selectedDifficulty;
}

// EASY 블록 왼쪽 여백에 표시하는 클리어 마크 하나. 3개 난이도마다 따로 표시하지 않고,
// 지금 선택된 난이도(selectedDifficulty, 전역)의 기록만 대표로 보여준다 — 난이도를
// 바꿔 고를 때마다(레벨 블록 클릭/팝업 난이도 버튼) renderSongList가 다시 불려서 자동으로 교체된다.
function clearMarkHtml(songId: string): string {
  const bestGrade = bestGradeForSong(clearRecords, songId, selectedDifficulty, ALL_GAUGE_TYPES);
  if (bestGrade === null) return `<span class="song-item-clear-mark"></span>`;
  return `<span class="song-item-clear-mark" style="color:${CLEAR_GRADE_COLOR[bestGrade]}">${CLEAR_GRADE_BADGE_TEXT[bestGrade]}</span>`;
}

function renderSongList(): void {
  const songsHtml = allSongs()
    .map(
      (song) => `
      <button type="button" class="song-item${armedDeleteSongId === song.id ? " delete-armed" : ""}" data-song-id="${song.id}">
        <div class="song-item-jacket" style="background:${jacketBackgroundCss(song)}"></div>
        <div class="song-item-meta">
          <div class="song-item-title">${song.title}</div>
          <div class="song-item-artist">${song.artist}</div>
        </div>
        <div class="song-item-levels-slot">
          <div class="song-item-levels">
            ${clearMarkHtml(song.id)}
            ${DIFFICULTIES.map((d) => {
              const level = song.levels[d];
              if (level === undefined) {
                return `<div class="level-block level-${d} level-block-missing"><span class="level-block-label">${DIFFICULTY_LABEL[d]}</span><span class="level-block-value">-</span></div>`;
              }
              return `<div class="level-block level-${d}${isActiveLevelBlock(song.id, d) ? " active" : ""}" data-difficulty="${d}"><span class="level-block-label">${DIFFICULTY_LABEL[d]}</span><span class="level-block-value">${level}</span></div>`;
            }).join("")}
          </div>
          ${isImportedSong(song.id) ? `<div class="song-item-delete-btn" data-song-id="${song.id}">삭제</div>` : ""}
        </div>
      </button>`,
    )
    .join("");

  songListEl.innerHTML = `${songsHtml}
    <div class="song-import-row">
      <button type="button" class="song-import-btn" id="song-import-btn">+ 채보 추가</button>
      <button type="button" class="song-refresh-btn" id="song-refresh-btn" title="곡 목록 새로고침">⟳</button>
    </div>`;
}

function renderPopupDifficultyButtons(song: SongEntry): void {
  songPopupDifficultyEl.innerHTML = DIFFICULTIES.filter((d) => song.levels[d] !== undefined)
    .map(
      (d) =>
        `<button type="button" class="difficulty-btn diff-${d}${d === selectedDifficulty ? " active" : ""}" data-difficulty="${d}">${DIFFICULTY_LABEL[d]} ${song.levels[d]}</button>`,
    )
    .join("");
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

// 팝업의 HI-SCORE(숫자만)와 클리어 마크를 지금 선택된 난이도 기준으로 갱신한다.
// 클리어 마크는 선곡 리스트와 동일하게, 게이지 타입 3개 중 가장 좋은 등급 하나만 보여준다.
function renderSongPopupStatus(song: SongEntry): void {
  const highScore = highScores[highScoreKey(song.id, selectedDifficulty)] ?? 0;
  songPopupHiScoreValue.textContent = String(highScore);

  // 정확도는 results.ts의 accuracyPercent와 같은 공식(score / 이론치 * 100)을 그대로
  // 재사용한다 — 별도로 저장하지 않아도 점수와 채보(이론치)만으로 그대로 복원된다.
  const theoreticalMax = countJudgeableNotes(parseChart(song.chartRawByDifficulty[selectedDifficulty])) * 4;
  const accuracyPercent = theoreticalMax === 0 ? 0 : (highScore / theoreticalMax) * 100;
  songPopupAccuracyValue.textContent = `${accuracyPercent.toFixed(2)}%`;

  const bestGrade = bestGradeForSong(clearRecords, song.id, selectedDifficulty, ALL_GAUGE_TYPES);
  if (bestGrade === null) {
    songPopupClearMark.textContent = "";
    songPopupClearMark.style.color = "";
  } else {
    songPopupClearMark.textContent = CLEAR_GRADE_LABEL[bestGrade]; // 선곡 리스트와 달리 팝업은 풀네임으로 표기
    songPopupClearMark.style.color = CLEAR_GRADE_COLOR[bestGrade];
  }
}

function openSongPopup(songId: string): void {
  selectedSongId = songId;
  const song = findSong(songId);
  selectedDifficulty = resolveDifficulty(song, selectedDifficulty);
  songPopupJacket.style.background = jacketBackgroundCss(song);
  songPopupTitle.textContent = song.title;
  songPopupArtist.textContent = song.artist;
  renderPopupDifficultyButtons(song);
  renderSongPopupStatus(song);
  updateMirrorToggleLabel();
  songPopup.classList.add("open");
  renderSongList(); // 리스트 쪽 강조 표시(선택된 곡의 선택된 난이도)를 갱신
}

function closeSongPopup(): void {
  songPopup.classList.remove("open");
  selectedSongId = null;
  renderSongList(); // 팝업이 닫히면 강조도 같이 사라진다
}

async function refreshSongList(): Promise<void> {
  importedSongEntries = await loadImportedSongEntries();
  renderSongList();
}

// 임포트 실패 배너는 5초간 보인 뒤 페이드아웃(0.4초)되며 자동으로 사라진다. 새 임포트
// 시도나 배너를 직접 닫는 동작이 끼어들면 기존 타이머를 취소하고 즉시 초기 상태로 되돌린다.
const SONG_IMPORT_ERROR_VISIBLE_MS = 5000;
const SONG_IMPORT_ERROR_FADE_MS = 400; // style.css의 .song-import-error transition과 일치시킨다
let songImportErrorFadeTimer: number | null = null;
let songImportErrorHideTimer: number | null = null;

function clearSongImportErrorTimers(): void {
  if (songImportErrorFadeTimer !== null) {
    window.clearTimeout(songImportErrorFadeTimer);
    songImportErrorFadeTimer = null;
  }
  if (songImportErrorHideTimer !== null) {
    window.clearTimeout(songImportErrorHideTimer);
    songImportErrorHideTimer = null;
  }
}

function hideSongImportError(): void {
  clearSongImportErrorTimers();
  songImportError.hidden = true;
  songImportError.textContent = "";
  songImportError.classList.remove("fade-out");
}

function showSongImportError(message: string): void {
  clearSongImportErrorTimers();
  songImportError.textContent = message;
  songImportError.classList.remove("fade-out");
  songImportError.hidden = false;
  songImportErrorFadeTimer = window.setTimeout(() => {
    songImportErrorFadeTimer = null;
    songImportError.classList.add("fade-out");
    songImportErrorHideTimer = window.setTimeout(() => {
      songImportErrorHideTimer = null;
      songImportError.hidden = true;
      songImportError.textContent = "";
      songImportError.classList.remove("fade-out");
    }, SONG_IMPORT_ERROR_FADE_MS);
  }, SONG_IMPORT_ERROR_VISIBLE_MS);
}

importZipInput.addEventListener("change", async () => {
  const file = importZipInput.files?.[0];
  importZipInput.value = ""; // 같은 파일을 다시 골라도 change가 또 발생하도록 비워둔다.
  if (!file) return;
  hideSongImportError();
  try {
    await importSongFromZip(file);
    await refreshSongList();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showSongImportError(`채보 임포트 실패: ${message}`);
  }
});

// 곡 카드를 길게 누르면(임포트한 곡만) 삭제 버튼이 드러난다. 실제 클릭 판정 대상은
// .song-item 전체이므로, 삭제 버튼이 없는 더미 곡을 눌러도 타이머는 돌지만 아무 UI도 뜨지 않는다.
songListEl.addEventListener("pointerdown", (event) => {
  const itemEl = (event.target as HTMLElement).closest<HTMLElement>(".song-item");
  if (itemEl === null) return;
  const songId = itemEl.dataset.songId!;
  if (!isImportedSong(songId)) return;

  clearLongPressTimer();
  longPressTimerId = window.setTimeout(() => {
    longPressTimerId = null;
    longPressJustArmed = true;
    armedDeleteSongId = songId;
    renderSongList();
  }, SONG_DELETE_LONG_PRESS_MS);
});

songListEl.addEventListener("pointerup", clearLongPressTimer);
songListEl.addEventListener("pointerleave", clearLongPressTimer);
songListEl.addEventListener("pointercancel", clearLongPressTimer);

// 리스트에서 특정 난이도 블록을 직접 클릭하면 그 난이도가 선택된 채로 팝업이 뜬다.
// "+ 채보 추가"/새로고침 버튼도 이 리스트 안에서 매 renderSongList마다 다시 그려지므로
// (개별 리스너 대신) 여기서 위임 처리한다.
songListEl.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  // 롱프레스로 막 삭제 버튼을 연 그 릴리즈 자체가 만든 click은 곡 선택으로 이어지면 안 된다.
  if (longPressJustArmed) {
    longPressJustArmed = false;
    return;
  }

  const deleteBtn = target.closest<HTMLElement>(".song-item-delete-btn");
  if (deleteBtn !== null) {
    void handleDeleteImportedSong(deleteBtn.dataset.songId!);
    return;
  }

  // 삭제 버튼이 열려 있는 상태에서 그 버튼이 아닌 다른 곳을 클릭하면, 이번 클릭은
  // "닫기"로만 소비하고 원래 클릭의 동작(곡 선택 등)은 실행하지 않는다.
  if (armedDeleteSongId !== null) {
    disarmDeleteSong();
    return;
  }

  if (target.closest("#song-import-btn")) {
    hideSongImportError();
    importZipInput.click();
    return;
  }
  if (target.closest("#song-refresh-btn")) {
    void refreshSongList();
    return;
  }

  const itemBtn = target.closest<HTMLButtonElement>(".song-item");
  if (itemBtn === null) return;
  const levelBlock = target.closest<HTMLElement>(".level-block");
  if (levelBlock !== null && levelBlock.dataset.difficulty) {
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
  renderSongPopupStatus(findSong(selectedSongId));
  renderSongList(); // 리스트 쪽 강조도 같이 갱신
});

// Esc를 누르거나 팝업/곡 목록 바깥을 클릭하면 팝업이 닫힌다. 곡 목록 클릭은
// 다른 곡을 고르는 정상 동작이라 닫힘 대상에서 제외한다. 열려 있는 삭제 버튼도 같이 닫는다.
window.addEventListener("keydown", (event) => {
  if (screen !== "songSelect") return;
  if (event.key !== "Escape") return;
  disarmDeleteSong();
  if (!songPopup.classList.contains("open")) return;
  closeSongPopup();
});

document.addEventListener("click", (event) => {
  if (screen !== "songSelect") return;
  // event.target으로 contains()를 검사하면 안 된다 — 난이도 버튼처럼 클릭 시
  // innerHTML을 다시 그리는 요소는 클릭 처리 도중 target이 DOM에서 떨어져나가
  // songPopup.contains(target)가 false로 오판되는 버그가 있었다.
  // composedPath()는 버블링 시작 시점의 경로를 그대로 담고 있어 안전하다.
  const path = event.composedPath();
  // 곡 목록 밖(옵션 버튼 등)을 클릭하면 열려 있는 삭제 버튼을 닫는다. 목록 안쪽 클릭은
  // songListEl의 click 리스너가 이미 열림/닫힘을 자체 처리하므로 여기서는 건드리지 않는다.
  if (!path.includes(songListEl)) disarmDeleteSong();
  if (!songPopup.classList.contains("open")) return;
  if (path.includes(songPopup) || path.includes(songListEl)) return;
  closeSongPopup();
});

// "곡 시작": 선택된 곡의 (선택된 난이도) 채보로 교체하고 게임 화면으로 넘어간다.
// 임포트한 곡은 audioBlob이 있어 실제로 재생되고, 더미 곡은 audioBlob이 없어 지금까지처럼 무음이다.
songPopupStartBtn.addEventListener("click", async () => {
  if (selectedSongId === null) return;
  songPopupStartBtn.disabled = true;
  songPopupStartBtn.textContent = "실행 중";

  const song = findSong(selectedSongId);
  chart = parseChart(song.chartRawByDifficulty[selectedDifficulty]);
  currentSongAudioBlob = song.audioBlob;

  // 게임 화면이 실제로 보이는 지금(zoom=1) 자연 크기를 측정해야 fitToViewport가 정확하다.
  screen = "gameplay";
  songSelectView.hidden = true;
  gameplayView.hidden = false;
  naturalWidth = app.scrollWidth;
  naturalHeight = app.scrollHeight;
  fitToViewport();

  await startPlay();

  songPopupStartBtn.disabled = false;
  songPopupStartBtn.textContent = "START";
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

renderSongList(); // 더미 3곡 먼저 즉시 표시하고, 임포트 곡은 IndexedDB 조회가 끝나는 대로 이어붙인다.
void refreshSongList();
applyOptionsFromInputs(); // 페이지 로드 시 불러온 프리셋 값을 런타임 상태에도 반영
