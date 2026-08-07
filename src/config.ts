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

// 판정선이 캔버스 하단에서 떨어진 거리(px). 기본값이며 옵션 화면에서 조절 가능.
export const JUDGE_LINE_MARGIN_BOTTOM = 120;
export const JUDGE_LINE_MARGIN_MIN = 40;
export const JUDGE_LINE_MARGIN_MAX = 400;

// --- 스크롤(그린넘버) ---
// 배속 1.0x 기준 그린넘버(ms).
export const BASE_GREEN_NUMBER_MS = 800;

// --- 속도 옵션 (SPEC.md 6절) ---
export const SPEED_MIN = 0.5;
export const SPEED_MAX = 10.0;
export const SPEED_STEP = 0.25;
export const GREEN_NUMBER_MIN_MS = BASE_GREEN_NUMBER_MS / SPEED_MAX;
export const GREEN_NUMBER_MAX_MS = BASE_GREEN_NUMBER_MS / SPEED_MIN;
// 플레이 중 실시간 속도 변경 단축키(텐키 아닌 숫자키 행). 브라우저 기본 단축키와
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
export const DEFAULT_HOLD_TICK_INTERVAL_BEATS = 1;

// 판정 텍스트가 화면에 머무는 시간(ms). 애니메이션은 마일스톤 9에서.
export const JUDGE_TEXT_DISPLAY_MS = 500;

// --- 결과 화면 (SPEC.md 5절) ---
// 판정이 붙는 레인. 마일스톤 7에서 FX가 추가되어 이제 모든 레인이 판정 대상이다.
export const JUDGEABLE_LANES: readonly NoteLane[] = [0, 1, 2, "fx", "scratch"];

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

// --- 스크래치 입력 (SPEC.md 2절) ---
// mousemove movementY 누적이 이 값(px)을 넘으면 스크래치 입력 1회로 인정.
export const SCRATCH_THRESHOLD = 20;
// 마지막 유효 스크래치로부터 이 시간(ms)이 지나면 방향 제한이 풀린다.
export const SCRATCH_DIR_RESET_MS = 2000;

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
