// 옵션 프리셋 직렬화/역직렬화. 실제 localStorage 접근은 main.ts의 얇은 어댑터가 담당하고,
// 여기는 순수 함수로만 구성해 테스트 가능하게 한다(SPEC.md 10절).
import type { Arrangement } from "./laneArrangement";
import {
  AUDIO_OFFSET_MS,
  BASE_GREEN_NUMBER_MS,
  type CanvasWidthOption,
  DEFAULT_CANVAS_WIDTH_OPTION,
  DEFAULT_NOTE_SKIN_ID,
  INPUT_OFFSET_MS,
  JUDGE_LINE_MARGIN_BOTTOM,
  PRESET_COUNT,
  SCRATCH_THRESHOLD,
} from "../config";

export interface OptionsSnapshot {
  canvasWidthOption: CanvasWidthOption;
  effectiveGreenNumberMs: number;
  arrangement: Arrangement;
  audioOffsetMs: number;
  inputOffsetMs: number;
  judgeLineMarginBottom: number;
  noteSkinId: string;
  scratchThreshold: number;
}

export function createDefaultSnapshot(): OptionsSnapshot {
  return {
    canvasWidthOption: DEFAULT_CANVAS_WIDTH_OPTION,
    effectiveGreenNumberMs: BASE_GREEN_NUMBER_MS,
    arrangement: "normal",
    audioOffsetMs: AUDIO_OFFSET_MS,
    inputOffsetMs: INPUT_OFFSET_MS,
    judgeLineMarginBottom: JUDGE_LINE_MARGIN_BOTTOM,
    noteSkinId: DEFAULT_NOTE_SKIN_ID,
    scratchThreshold: SCRATCH_THRESHOLD,
  };
}

// 슬롯이 비어있으면(아직 저장한 적 없음) null — 이때는 기본값을 보여준다.
export type PresetSlots = (OptionsSnapshot | null)[];

export function createEmptyPresetSlots(): PresetSlots {
  return Array.from({ length: PRESET_COUNT }, () => null);
}

function isValidSnapshot(value: unknown): value is OptionsSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.canvasWidthOption === "narrow" || v.canvasWidthOption === "normal" || v.canvasWidthOption === "wide") &&
    typeof v.effectiveGreenNumberMs === "number" &&
    (v.arrangement === "normal" || v.arrangement === "mirror") &&
    typeof v.audioOffsetMs === "number" &&
    typeof v.inputOffsetMs === "number" &&
    typeof v.judgeLineMarginBottom === "number" &&
    typeof v.noteSkinId === "string" &&
    typeof v.scratchThreshold === "number"
  );
}

export function serializePresets(presets: PresetSlots): string {
  return JSON.stringify(presets);
}

// 저장된 값이 없거나 형식이 깨졌으면 빈 프리셋(전부 null)으로 안전하게 대체한다.
export function parsePresets(raw: string | null): PresetSlots {
  if (raw === null) return createEmptyPresetSlots();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return createEmptyPresetSlots();
  }
  if (!Array.isArray(parsed) || parsed.length !== PRESET_COUNT) return createEmptyPresetSlots();
  return parsed.map((entry) => (isValidSnapshot(entry) ? entry : null));
}

export function clampPresetIndex(index: number): number {
  const truncated = Number.isFinite(index) ? Math.trunc(index) : 0;
  return Math.min(PRESET_COUNT - 1, Math.max(0, truncated));
}

export function parseActivePresetIndex(raw: string | null): number {
  if (raw === null) return 0;
  return clampPresetIndex(Number(raw));
}
