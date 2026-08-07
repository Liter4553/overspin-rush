import { describe, expect, it } from "vitest";
import {
  clampPresetIndex,
  createDefaultSnapshot,
  createEmptyPresetSlots,
  parseActivePresetIndex,
  parsePresets,
  serializePresets,
  type OptionsSnapshot,
} from "./optionsStorage";

function makeSnapshot(overrides: Partial<OptionsSnapshot> = {}): OptionsSnapshot {
  return { ...createDefaultSnapshot(), ...overrides };
}

describe("parsePresets / serializePresets", () => {
  it("저장된 값이 없으면 빈 프리셋 3개를 반환한다", () => {
    expect(parsePresets(null)).toEqual(createEmptyPresetSlots());
  });

  it("깨진 JSON이면 빈 프리셋으로 안전하게 대체한다", () => {
    expect(parsePresets("not json")).toEqual(createEmptyPresetSlots());
  });

  it("개수가 안 맞으면(예전 포맷 등) 빈 프리셋으로 대체한다", () => {
    expect(parsePresets(JSON.stringify([null, null]))).toEqual(createEmptyPresetSlots());
  });

  it("직렬화 -> 역직렬화 라운드트립이 원래 값을 그대로 복원한다", () => {
    const presets = [makeSnapshot({ canvasWidthOption: "wide" }), null, makeSnapshot({ arrangement: "mirror" })];
    const restored = parsePresets(serializePresets(presets));
    expect(restored).toEqual(presets);
  });

  it("일부 슬롯의 데이터가 손상됐으면 그 슬롯만 null로 대체한다", () => {
    const raw = JSON.stringify([{ broken: true }, makeSnapshot(), null]);
    const restored = parsePresets(raw);
    expect(restored[0]).toBeNull();
    expect(restored[1]).toEqual(makeSnapshot());
    expect(restored[2]).toBeNull();
  });
});

describe("clampPresetIndex / parseActivePresetIndex", () => {
  it("범위를 벗어난 인덱스는 clamp한다", () => {
    expect(clampPresetIndex(-1)).toBe(0);
    expect(clampPresetIndex(99)).toBe(2);
  });

  it("숫자가 아닌 저장값은 0번 프리셋으로 대체한다", () => {
    expect(parseActivePresetIndex("nope")).toBe(0);
  });

  it("저장된 값이 없으면 0번 프리셋이다", () => {
    expect(parseActivePresetIndex(null)).toBe(0);
  });

  it("유효한 값은 그대로(clamp만 적용) 복원한다", () => {
    expect(parseActivePresetIndex("2")).toBe(2);
  });
});
