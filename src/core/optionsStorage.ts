// 옵션 프리셋 직렬화/역직렬화. 실제 localStorage 접근은 main.ts의 얇은 어댑터가 담당하고,
// 여기는 순수 함수로만 구성해 테스트 가능하게 한다(SPEC.md 10절).
import type { Arrangement } from "./laneArrangement";
import { ALL_BINDABLE_SLOTS, createDefaultKeyBindings, type KeyBindings } from "./keymapOptions";
import {
  AUDIO_OFFSET_MS,
  type CanvasWidthOption,
  DEFAULT_CANVAS_WIDTH_OPTION,
  DEFAULT_GAUGE_TYPE,
  DEFAULT_KEYMAP,
  DEFAULT_NOTE_SPEED,
  DEFAULT_NOTE_SKIN_ID,
  DEFAULT_SCRATCH_SIDE,
  type GaugeType,
  INPUT_OFFSET_MS,
  JUDGE_LINE_MARGIN_BOTTOM,
  PRESET_COUNT,
  type ScratchSide,
  SCRATCH_THRESHOLD,
} from "../config";

export interface OptionsSnapshot {
  canvasWidthOption: CanvasWidthOption;
  noteSpeed: number;
  arrangement: Arrangement;
  audioOffsetMs: number;
  inputOffsetMs: number;
  judgeLineMarginBottom: number;
  noteSkinId: string;
  scratchThreshold: number;
  scratchSide: ScratchSide;
  keyBindings: KeyBindings;
  gaugeType: GaugeType;
  gasEnabled: boolean;
}

export function createDefaultSnapshot(): OptionsSnapshot {
  return {
    canvasWidthOption: DEFAULT_CANVAS_WIDTH_OPTION,
    noteSpeed: DEFAULT_NOTE_SPEED,
    arrangement: "normal",
    audioOffsetMs: AUDIO_OFFSET_MS,
    inputOffsetMs: INPUT_OFFSET_MS,
    judgeLineMarginBottom: JUDGE_LINE_MARGIN_BOTTOM,
    noteSkinId: DEFAULT_NOTE_SKIN_ID,
    scratchThreshold: SCRATCH_THRESHOLD,
    scratchSide: DEFAULT_SCRATCH_SIDE,
    keyBindings: createDefaultKeyBindings(DEFAULT_KEYMAP),
    gaugeType: DEFAULT_GAUGE_TYPE,
    gasEnabled: false,
  };
}

// 슬롯이 비어있으면(아직 저장한 적 없음) null — 이때는 기본값을 보여준다.
export type PresetSlots = (OptionsSnapshot | null)[];

export function createEmptyPresetSlots(): PresetSlots {
  return Array.from({ length: PRESET_COUNT }, () => null);
}

function isValidKeyBindings(value: unknown): value is KeyBindings {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return ALL_BINDABLE_SLOTS.every((slot) => typeof v[slot] === "string" && v[slot] !== "");
}

function isValidSnapshot(value: unknown): value is OptionsSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.canvasWidthOption === "narrow" || v.canvasWidthOption === "normal" || v.canvasWidthOption === "wide") &&
    typeof v.noteSpeed === "number" &&
    (v.arrangement === "normal" || v.arrangement === "mirror") &&
    typeof v.audioOffsetMs === "number" &&
    typeof v.inputOffsetMs === "number" &&
    typeof v.judgeLineMarginBottom === "number" &&
    typeof v.noteSkinId === "string" &&
    typeof v.scratchThreshold === "number" &&
    (v.scratchSide === "left" || v.scratchSide === "right") &&
    isValidKeyBindings(v.keyBindings) &&
    (v.gaugeType === "normal" || v.gaugeType === "hard" || v.gaugeType === "challenge") &&
    typeof v.gasEnabled === "boolean"
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
