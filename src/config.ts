// 게임 전역 상수. 매직넘버 금지 — 값은 전부 여기서 관리한다.

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
export const FX_COLOR = "#BA7517";
export const FX_OPACITY = 0.38;
export const SCRATCH_NOTE_COLOR = "#5DCAA5";
export const SCRATCH_LANE_TINT_COLOR = "#1D9E75";
export const SCRATCH_LANE_TINT_OPACITY = 0.14;
export const JUDGE_LINE_COLOR = "#D85A30";
export const LANE_DIVIDER_COLOR = "rgba(255, 255, 255, 0.15)";
