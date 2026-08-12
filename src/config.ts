// 게임 전역 상수. 매직넘버 금지 — 값은 전부 여기서 관리한다.
import type { JudgeTableEntry } from "./core/judge";
import type { NoteLane } from "./chart/types";

// 마일스톤 1 임시 표시용 기본 BPM. 이후 채보 로드 시 bpmChanges로 대체된다.
export const DEFAULT_BPM = 150;

// .pattern 채보 포맷(SPEC.md 7-1절)의 마디당 틱 수. 1마디(4/4) = 16분음표 16개.
export const PATTERN_TICKS_PER_MEASURE = 16;

// --- 캔버스 / 레인 레이아웃 (SPEC.md 6절) ---
export const CANVAS_HEIGHT = 800;

// 캔버스 폭 3단계. 보통을 기준으로 좁게/넓게는 각각 ∓30%.
export const CANVAS_WIDTH_OPTIONS = {
  narrow: 336,
  normal: 480,
  wide: 624,
} as const;
export type CanvasWidthOption = keyof typeof CANVAS_WIDTH_OPTIONS;
export const DEFAULT_CANVAS_WIDTH_OPTION: CanvasWidthOption = "normal";

export const LANE_COUNT = 3;

// 스크래치 레인 폭 = 노트 레인 폭 + SCRATCH_WIDTH_EXTRA.
export const SCRATCH_WIDTH_EXTRA = 20;

export type ScratchSide = "left" | "right";
// 오른손 마우스 사용자가 다수이므로 기본값은 오른쪽.
export const DEFAULT_SCRATCH_SIDE: ScratchSide = "right";

// 판정선이 캔버스 하단에서 떨어진 거리(px). 기본값이며 옵션 화면에서 조절 가능.
export const JUDGE_LINE_MARGIN_BOTTOM = 120;
export const JUDGE_LINE_MARGIN_MIN = 40;
export const JUDGE_LINE_MARGIN_MAX = 400;

// --- 스크롤(노트 속도, 2026-08-11 결정) ---
// "노트 속도" 값(작을수록 빠름)과 그 시점의 BPM으로 낙하 시간(ms)을 계산하는데, 이 계산은
// 곡 시작 시점(또는 플레이 중 실시간 변경 시점)에 딱 한 번만 이뤄지고 고정된다. 이후 곡
// 도중 BPM이 바뀌면(예: 곡 중간에 느려지는 구간) 그 계산을 다시 하는 게 아니라, 처음 고정한
// 배속 그대로 바뀐 BPM에 비례해서 스크롤 속도에 반영한다 — BPM이 느려지면 스크롤도 같이
// 느려진다(그린넘버처럼 BPM 변화를 상쇄해서 항상 똑같아 보이게 만들지 않는다).
// baseGreenNumberMs: 배속 1.0x(노트 속도 == 그 시점 BPM)일 때의 낙하 시간(ms) 기준값.
export const BASE_GREEN_NUMBER_MS = 800;
export const DEFAULT_NOTE_SPEED = 150; // 더미 채보(BPM 150)에서는 예전 배속 1.0x와 동일하게 보인다.
export const NOTE_SPEED_MIN = 50;
export const NOTE_SPEED_MAX = 1500;
export const NOTE_SPEED_STEP = 5;
// BPM/노트 속도 조합이 극단적이어도 낙하 시간이 너무 짧거나(순간이동처럼 보임) 너무
// 길어지지(거의 안 움직임) 않도록 렌더링에 실제 쓰이는 낙하 시간(ms) 자체도 clamp한다.
export const FALL_TIME_MIN_MS = 80;
export const FALL_TIME_MAX_MS = 1600;
// 플레이 중 실시간 노트 속도 변경 단축키(텐키 아닌 숫자키 행). 브라우저 기본 단축키와
// 겹치는 펑션키(F3/F4 등) 대신 선택.
export const SPEED_DECREASE_KEY = "1";
export const SPEED_INCREASE_KEY = "2";

// --- 노트 렌더링 ---
export const NOTE_HEIGHT = 26;
// 노트가 레인 폭 대비 좌우로 두는 여백(px).
export const NOTE_INSET = 10;

export const NOTE_COLOR = "#378ADD";
export const FX_COLOR = "#EF9F27";
export const FX_OPACITY = 0.55;
export const SCRATCH_NOTE_COLOR = "#5DCAA5";
// 스크래치 노트 프레임(일반 노트와 형태 통일) 안에 마름모를 그릴 때의 여백 비율.
export const SCRATCH_DIAMOND_INSET_RATIO = 0.28;
export const SCRATCH_LANE_TINT_COLOR = "#1D9E75";
export const SCRATCH_LANE_TINT_OPACITY = 0.14;
export const JUDGE_LINE_COLOR = "#D85A30";
export const LANE_DIVIDER_COLOR = "rgba(255, 255, 255, 0.15)";

// --- 노트 스킨 색상 (SPEC.md 6절) ---
// 자유 색상 선택 대신 가독성 검증된 팔레트 5종 중에서 고른다.
export interface NoteSkinPalette {
  id: string;
  label: string;
  noteColor: string;
  fxColor: string;
  scratchColor: string;
}

export const NOTE_SKIN_PALETTES: readonly NoteSkinPalette[] = [
  { id: "default", label: "기본", noteColor: NOTE_COLOR, fxColor: FX_COLOR, scratchColor: SCRATCH_NOTE_COLOR },
  { id: "neon", label: "네온", noteColor: "#6C5CE7", fxColor: "#FD79A8", scratchColor: "#00CEC9" },
  { id: "sunset", label: "선셋", noteColor: "#FF6B6B", fxColor: "#FFA94D", scratchColor: "#4DABF7" },
  { id: "forest", label: "포레스트", noteColor: "#63B85C", fxColor: "#E8B33D", scratchColor: "#22B8CF" },
  { id: "ice", label: "아이스", noteColor: "#74B9FF", fxColor: "#A29BFE", scratchColor: "#81ECEC" },
];
export const DEFAULT_NOTE_SKIN_ID = "default";

// --- 판정 (SPEC.md 4절) ---
// 각 값은 패스트/슬로우 각각의 한계값(대칭). windowMs 오름차순 유지 필수.
export const NOTE_JUDGMENT_TABLE: readonly JudgeTableEntry[] = [
  { grade: "PERFECT_PLUS", windowMs: 20, score: 4 },
  { grade: "PERFECT", windowMs: 40, score: 3 },
  { grade: "GREAT", windowMs: 60, score: 2 },
  { grade: "GOOD", windowMs: 80, score: 1 },
];

// 스크래치는 PERFECT 등급이 없다(의도된 설계). 40ms를 벗어나면 곧바로 GREAT로 떨어진다.
export const SCRATCH_JUDGMENT_TABLE: readonly JudgeTableEntry[] = [
  { grade: "PERFECT_PLUS", windowMs: 40, score: 4 },
  { grade: "GREAT", windowMs: 60, score: 2 },
  { grade: "GOOD", windowMs: 80, score: 1 },
];

// 노트가 슬로우 쪽으로 이 값(ms)을 지나면 자동 MISS. GOOD 윈도우와 동일해야 한다.
export const AUTO_MISS_WINDOW_MS = 80;

// 사용자 조정 가능한 오디오/입력 오프셋(ms) 기본값. 옵션 화면에서 실시간으로 바꿀 수 있다.
export const AUDIO_OFFSET_MS = 0;
export const INPUT_OFFSET_MS = 0;
export const OFFSET_MIN_MS = -300;
export const OFFSET_MAX_MS = 300;

// --- 키 입력 ---
// 마일스톤 8 리매핑 UI가 이 맵만 교체하면 되도록 분리.
export const DEFAULT_KEYMAP: Readonly<Record<string, 0 | 1 | 2 | "fx">> = {
  a: 0,
  s: 1,
  d: 2,
  " ": "fx",
};

// --- 판정바 ---
export const JUDGMENT_BAR_RANGE_MS = 80; // GOOD 경계까지 표시
export const JUDGMENT_BAR_HEIGHT = 40;
export const JUDGMENT_BAR_MARGIN_TOP = 24; // 판정선 아래로 떨어진 거리(px)
export const JUDGMENT_TICK_FADE_MS = 2000;
export const JUDGMENT_TICK_HISTORY_MAX = 30;

export const JUDGE_GRADE_COLORS: Readonly<Record<string, string>> = {
  PERFECT_PLUS: "#FAC775",
  PERFECT: "#5DCAA5",
  GREAT: "#85B7EB",
  GOOD: "#B4B2A9",
  MISS: "#F09595",
};

// --- 홀드 틱 (마일스톤 6에서 사용) ---
// 4분음표를 1비트로 볼 때, 16분음표는 0.25비트다(2026-08-13 변경: 1비트 -> 16분음표).
export const DEFAULT_HOLD_TICK_INTERVAL_BEATS = 0.25;

// 판정 텍스트가 화면에 머무는 시간(ms).
export const JUDGE_TEXT_DISPLAY_MS = 500;
// 등장 시 살짝 커졌다가 원래 크기로 줄어드는 팝인 구간 길이(ms, DISPLAY_MS 앞부분).
export const JUDGE_TEXT_POP_MS = 90;
// 사라지기 전 페이드아웃 구간 길이(ms, DISPLAY_MS 뒷부분).
export const JUDGE_TEXT_FADE_MS = 200;

// 노트 히트 이펙트(판정선 플래시)가 지속되는 시간(ms). MISS는 이펙트가 없다.
export const HIT_EFFECT_DURATION_MS = 220;

// 키빔(판정선에서 위로 뻗는 입력 피드백) 지속 시간과 길이. 판정 성공 여부와 무관하게
// 키를 누르는/스크래치가 유효한 순간마다 뜬다(히트 이펙트와는 별개).
export const KEY_BEAM_DURATION_MS = 150;
export const KEY_BEAM_LENGTH_PX = 200;

// --- 결과 화면 (SPEC.md 5절) ---
// 판정이 붙는 레인. 마일스톤 7에서 FX가 추가되어 이제 모든 레인이 판정 대상이다.
export const JUDGEABLE_LANES: readonly NoteLane[] = [0, 1, 2, "fx", "scratch"];

// --- 화면 맞춤(뷰포트 핏) ---
// 플레이 영역+HUD 전체를 브라우저 세로 길이에 맞춰 확대/축소할 때 쓰는 값.
export const VIEWPORT_FIT_MARGIN_PX = 16;
export const VIEWPORT_FIT_MIN_SCALE = 0.4;
export const VIEWPORT_FIT_MAX_SCALE = 1.8;

// 결과 화면은 콘텐츠가 적어서 게임 화면과 같은 배율이면 상대적으로 작아 보인다.
// 게임 화면 맞춤 배율(scale) 위에 이 배수를 추가로 곱해서 더 크게 보여준다.
export const RESULTS_SCALE_BOOST = 1.46;

// --- 스크래치 입력 (SPEC.md 2절) ---
// mousemove movementY 누적이 이 값(px)을 넘으면 스크래치 입력 1회로 인정.
// 값이 작을수록(=마우스 감도가 높을수록) 적은 움직임으로도 인정된다. 옵션 화면에서 조절 가능.
export const SCRATCH_THRESHOLD = 20;
export const SCRATCH_THRESHOLD_MIN = 5;
export const SCRATCH_THRESHOLD_MAX = 60;
// 마지막 유효 스크래치로부터 이 시간(ms)이 지나면 방향 제한이 풀린다.
export const SCRATCH_DIR_RESET_MS = 2000;

// --- 오프셋 자동 보정 마법사 (SPEC.md 6절) ---
// 시각 테스트(소리 없음)로 입력 오프셋을, 그 값을 기준으로 오디오 테스트(쿵짝 드럼)로
// 오디오 오프셋을 역산한다. 두 테스트 모두 같은 박자 구성(BPM/마디)을 공유한다.
export const CALIBRATION_BPM = 120;
export const CALIBRATION_BEATS_PER_MEASURE = 4;
export const CALIBRATION_MEASURES = 4; // 총 16박
// 박자와 입력을 매칭할 때 허용하는 오차(ms). 실제 판정 윈도우(±80ms)보다 훨씬 넉넉하게
// 잡아서, 보정 전 오프셋이 심하게 틀어져 있어도 매칭 자체는 되도록 한다.
export const CALIBRATION_MATCH_TOLERANCE_MS = 200;
// 총 16박 중 이 값 미만으로 매칭되면 표본 부족으로 판단하고 결과를 신뢰하지 않는다.
export const CALIBRATION_MIN_MATCHED_BEATS = 8;

// --- 옵션 프리셋 저장/복원 (SPEC.md 6절) ---
// 자동 저장 하나가 아니라, 사용자가 원하는 슬롯에 명시적으로 저장/전환하는 프리셋 3개.
export const PRESET_COUNT = 3;
export const PRESET_STORAGE_KEY = "overspin-rush:presets";
export const ACTIVE_PRESET_STORAGE_KEY = "overspin-rush:activePreset";

// --- 일시정지 ---
// ESC 또는 Pointer Lock 해제 시 일시정지(SPEC.md 9절 폴리싱의 일시정지를
// Pointer Lock 요구사항 때문에 최소 기능으로 앞당겨 구현).
export const PAUSE_TRIGGER_KEY = "Escape";
// 재개 버튼을 누른 뒤 실제로 재생이 이어지기까지의 카운트다운(초).
// 지금은 뼈대만 — 연출/스킵 등은 마일스톤 9(폴리싱)에서 다듬는다.
export const RESUME_COUNTDOWN_SECONDS = 3;

// --- 게이지 (SPEC.md 9절 폴리싱) ---
// NORMAL(그루브형): 0%에서 시작, 곡 종료 시 보더 이상이면 클리어. 폭사 없음.
// HARD/CHALLENGE(서바이벌형): 100%에서 시작, 하한(사실상 0%) 도달 시 즉시 폭사.
export type GaugeType = "normal" | "hard" | "challenge";

export interface GaugeTypeConfig {
  readonly id: GaugeType;
  readonly label: string;
  readonly start: number; // 시작값(%)
  readonly border: number | null; // 클리어 보더(%). survival 타입은 폭사 여부로만 판정하므로 null.
  readonly survival: boolean; // true면 하한 도달 시 즉시 폭사.
  readonly lowHealthCorrection: boolean; // 저체력 보정(미스 감소량 절반) 적용 여부. HARD 전용.
  readonly missPercent: number; // 기본 미스 감소량(양수로 표기, 실제로는 차감).
}

// 저체력 보정 발동 기준(%). HARD가 이 값 이하일 때 미스 감소량이 절반이 된다.
export const GAUGE_LOW_HEALTH_THRESHOLD = 30;
// 감소 후 잔량이 이 값(%) 미만이면 0%로 처리하고 서바이벌 게이지는 즉시 폭사한다.
export const GAUGE_DEATH_THRESHOLD = 2;
// 서바이벌형(HARD/CHALLENGE) 홀드 유지 틱 증가량 및 PERFECT+/PERFECT, GREAT 증가량(%).
export const GAUGE_SURVIVAL_PERFECT_PERCENT = 0.16;
export const GAUGE_SURVIVAL_GREAT_PERCENT = 0.08;

export const GAUGE_TYPE_CONFIG: Readonly<Record<GaugeType, GaugeTypeConfig>> = {
  normal: {
    id: "normal",
    label: "NORMAL",
    start: 0,
    border: 70,
    survival: false,
    lowHealthCorrection: false,
    missPercent: 4.5,
  },
  hard: {
    id: "hard",
    label: "HARD",
    start: 100,
    border: null,
    survival: true,
    lowHealthCorrection: true,
    missPercent: 9.0,
  },
  challenge: {
    id: "challenge",
    label: "CHALLENGE",
    start: 100,
    border: null,
    survival: true,
    lowHealthCorrection: false,
    missPercent: 18.0,
  },
};

// NORMAL 전용 계수 a(%) 산출 상수. 채보 로드 시 총 판정 대상 노트 수(n)로 1회만 계산한다.
export const GAUGE_COEFFICIENT_SMALL_CHART_THRESHOLD = 350; // n < 이 값이면 소형 채보 공식 사용.
export const GAUGE_COEFFICIENT_SMALL_CHART_NUMERATOR = 266.67; // a = 이 값 / n
export const GAUGE_COEFFICIENT_LARGE_CHART_NUMERATOR = 800; // a = 이 값 / (n + OFFSET)
export const GAUGE_COEFFICIENT_LARGE_CHART_OFFSET = 700;

export const DEFAULT_GAUGE_TYPE: GaugeType = "normal";

// HARD/CHALLENGE 폭사 시 레인 위에서 내려오는 FAILED 셔터 연출 시간(ms). CSS 애니메이션과 일치해야 한다.
export const FAIL_SHUTTER_DROP_MS = 700;
// 셔터가 다 내려온 뒤 결과 화면으로 넘어가기 전 대기 시간(ms). FAILED 문구를 충분히 보여준다.
export const FAIL_RESULTS_DELAY_MS = 3000;

// 곡+난이도+게이지타입별 최고 클리어 등급 기록 저장 키.
export const CLEAR_RECORDS_STORAGE_KEY = "overspin-rush:clearRecords";
// 곡+난이도별 최고 점수 저장 키(게이지 타입과 무관).
export const HIGH_SCORE_STORAGE_KEY = "overspin-rush:highScores";
