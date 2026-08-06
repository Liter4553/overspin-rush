// 게임 전역 상수. 매직넘버 금지 — 값은 전부 여기서 관리한다.
import type { JudgeTableEntry } from "./core/judge";
import type { NoteLane } from "./chart/types";

// 마일스톤 1 임시 표시용 기본 BPM. 이후 채보 로드 시 bpmChanges로 대체된다.
export const DEFAULT_BPM = 150;

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

// 판정선이 캔버스 하단에서 떨어진 거리(px).
export const JUDGE_LINE_MARGIN_BOTTOM = 120;

// --- 스크롤(그린넘버) ---
// 배속 1.0x 기준 그린넘버(ms). 배속/그린넘버 변환은 마일스톤 8에서 연결한다.
export const BASE_GREEN_NUMBER_MS = 800;

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

// 사용자 조정 가능한 오디오/입력 오프셋(ms). 실제 조절 UI는 마일스톤 8.
export const AUDIO_OFFSET_MS = 0;
export const INPUT_OFFSET_MS = 0;

// --- 키 입력 ---
// 마일스톤 8 리매핑 UI가 이 맵만 교체하면 되도록 분리.
export const DEFAULT_KEYMAP: Readonly<Record<string, 0 | 1 | 2>> = {
  a: 0,
  s: 1,
  d: 2,
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
export const DEFAULT_HOLD_TICK_INTERVAL_BEATS = 1;

// 판정 텍스트가 화면에 머무는 시간(ms). 애니메이션은 마일스톤 9에서.
export const JUDGE_TEXT_DISPLAY_MS = 500;

// --- 결과 화면 (SPEC.md 5절) ---
// 지금 실제로 판정되는 레인. 마일스톤 5(스크래치)/7(FX)에서 판정이 붙으면
// 여기에 추가하기만 하면 이론치/완료 판정이 자동으로 확장된다.
export const JUDGEABLE_LANES: readonly NoteLane[] = [0, 1, 2];

// 오차 분포 히스토그램 버킷 폭(ms). JUDGMENT_BAR_RANGE_MS(80)를 이 값으로 나눠
// 좌우 대칭 버킷 개수를 만든다.
export const ERROR_HISTOGRAM_BUCKET_MS = 10;

// --- 화면 맞춤(뷰포트 핏) ---
// 플레이 영역+HUD 전체를 브라우저 세로 길이에 맞춰 확대/축소할 때 쓰는 값.
export const VIEWPORT_FIT_MARGIN_PX = 16;
export const VIEWPORT_FIT_MIN_SCALE = 0.4;
export const VIEWPORT_FIT_MAX_SCALE = 1.8;

// 결과 화면은 콘텐츠가 적어서 게임 화면과 같은 배율이면 상대적으로 작아 보인다.
// 게임 화면 맞춤 배율(scale) 위에 이 배수를 추가로 곱해서 더 크게 보여준다.
export const RESULTS_SCALE_BOOST = 1.46;
