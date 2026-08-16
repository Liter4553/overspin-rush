import { describe, expect, it } from "vitest";
import {
  bindingsToKeymap,
  createDefaultKeyBindings,
  keymapToBindings,
  MOUSE_BINDING,
  rebindKey,
  type KeyBindings,
} from "./keymapOptions";
import { DEFAULT_KEYMAP } from "../config";

const RESERVED_KEYS = ["Escape", "1", "2"];

function fullBindings(overrides: Partial<KeyBindings> = {}): KeyBindings {
  return { ...createDefaultKeyBindings(DEFAULT_KEYMAP), ...overrides };
}

describe("keymapToBindings / bindingsToKeymap", () => {
  it("DEFAULT_KEYMAP을 레인 기준으로 뒤집고 다시 원래대로 되돌릴 수 있다", () => {
    const bindings = keymapToBindings(DEFAULT_KEYMAP);
    expect(bindings).toEqual({ 0: "a", 1: "s", 2: "d", fx: " " });
    expect(bindingsToKeymap(fullBindings())).toEqual(DEFAULT_KEYMAP);
  });

  it("scratch 레인은 bindings에서 제외된다", () => {
    const bindings = keymapToBindings({ a: 0, rshift: "scratch" });
    expect(bindings).toEqual({ 0: "a" });
  });
});

describe("createDefaultKeyBindings", () => {
  it("레인은 DEFAULT_KEYMAP을, 스크래치 업/다운은 마우스를 기본값으로 한다", () => {
    const bindings = createDefaultKeyBindings(DEFAULT_KEYMAP);
    expect(bindings).toEqual({ 0: "a", 1: "s", 2: "d", fx: " ", scratchUp: MOUSE_BINDING, scratchDown: MOUSE_BINDING });
  });
});

describe("rebindKey", () => {
  it("사용 가능한 키로 재배정한다", () => {
    const result = rebindKey(fullBindings(), 0, "q", RESERVED_KEYS);
    expect(result.ok).toBe(true);
    expect(result.bindings[0]).toBe("q");
    expect(result.bindings[1]).toBe("s"); // 다른 슬롯은 그대로
  });

  it("대문자로 입력해도 소문자로 정규화해 저장한다", () => {
    const result = rebindKey(fullBindings(), 0, "Q", RESERVED_KEYS);
    expect(result.bindings[0]).toBe("q");
  });

  it("예약된 키(일시정지/배속 변경)로는 재배정할 수 없다", () => {
    const bindings = fullBindings();
    const result = rebindKey(bindings, 0, "Escape", RESERVED_KEYS);
    expect(result.ok).toBe(false);
    expect(result.bindings).toEqual(bindings); // 실패 시 원본 유지
  });

  it("다른 레인이 이미 쓰는 키로는 재배정할 수 없다", () => {
    const result = rebindKey(fullBindings(), 0, "s", RESERVED_KEYS);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("duplicateKey");
  });

  it("자기 자신이 쓰던 키로 다시 배정하는 건 허용한다", () => {
    const result = rebindKey(fullBindings(), 0, "a", RESERVED_KEYS);
    expect(result.ok).toBe(true);
  });

  it("스크래치 슬롯은 키로 재배정할 수 있다", () => {
    const result = rebindKey(fullBindings(), "scratchUp", "i", RESERVED_KEYS);
    expect(result.ok).toBe(true);
    expect(result.bindings.scratchUp).toBe("i");
    expect(result.bindings.scratchDown).toBe(MOUSE_BINDING); // 다른 스크래치 슬롯은 그대로 마우스
  });

  it("레인 키와 스크래치 키가 서로 충돌하면 거부한다", () => {
    const result = rebindKey(fullBindings(), "scratchUp", "a", RESERVED_KEYS); // 'a'는 이미 레인 0
    expect(result.ok).toBe(false);
  });

  it("스크래치 업/다운 둘 다 마우스인 기본 상태는 충돌로 취급하지 않는다", () => {
    const result = rebindKey(fullBindings(), "scratchDown", MOUSE_BINDING, RESERVED_KEYS);
    expect(result.ok).toBe(true);
    expect(result.bindings.scratchUp).toBe(MOUSE_BINDING);
    expect(result.bindings.scratchDown).toBe(MOUSE_BINDING);
  });

  it("스크래치 슬롯을 키에서 다시 마우스로 되돌릴 수 있다", () => {
    const rebound = rebindKey(fullBindings(), "scratchUp", "i", RESERVED_KEYS).bindings;
    const result = rebindKey(rebound, "scratchUp", MOUSE_BINDING, RESERVED_KEYS);
    expect(result.ok).toBe(true);
    expect(result.bindings.scratchUp).toBe(MOUSE_BINDING);
  });

  it("레인 슬롯은 마우스로 설정할 수 없다", () => {
    const result = rebindKey(fullBindings(), 0, MOUSE_BINDING, RESERVED_KEYS);
    expect(result.ok).toBe(false);
  });
});
