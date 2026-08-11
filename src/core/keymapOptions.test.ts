import { describe, expect, it } from "vitest";
import { bindingsToKeymap, keymapToBindings, rebindKey, type KeyBindings } from "./keymapOptions";
import { DEFAULT_KEYMAP } from "../config";

const RESERVED_KEYS = ["Escape", "1", "2"];

describe("keymapToBindings / bindingsToKeymap", () => {
  it("DEFAULT_KEYMAP을 레인 기준으로 뒤집고 다시 원래대로 되돌릴 수 있다", () => {
    const bindings = keymapToBindings(DEFAULT_KEYMAP);
    expect(bindings).toEqual({ 0: "a", 1: "s", 2: "d", fx: " " });
    expect(bindingsToKeymap(bindings)).toEqual(DEFAULT_KEYMAP);
  });

  it("scratch 레인은 bindings에서 제외된다", () => {
    const bindings = keymapToBindings({ a: 0, rshift: "scratch" });
    expect(bindings).toEqual({ 0: "a" });
  });

  it("대소문자를 정규화한다", () => {
    const keymap = bindingsToKeymap({ 0: "A", 1: "S", 2: "D", fx: " " } as KeyBindings);
    expect(keymap).toEqual({ a: 0, s: 1, d: 2, " ": "fx" });
  });
});

describe("rebindKey", () => {
  const bindings: KeyBindings = { 0: "a", 1: "s", 2: "d", fx: " " };

  it("사용 가능한 키로 재배정한다", () => {
    const result = rebindKey(bindings, 0, "q", RESERVED_KEYS);
    expect(result.ok).toBe(true);
    expect(result.bindings[0]).toBe("q");
    expect(result.bindings[1]).toBe("s"); // 다른 레인은 그대로
  });

  it("대문자로 입력해도 소문자로 정규화해 저장한다", () => {
    const result = rebindKey(bindings, 0, "Q", RESERVED_KEYS);
    expect(result.bindings[0]).toBe("q");
  });

  it("예약된 키(일시정지/배속 변경)로는 재배정할 수 없다", () => {
    const result = rebindKey(bindings, 0, "Escape", RESERVED_KEYS);
    expect(result.ok).toBe(false);
    expect(result.bindings).toEqual(bindings); // 실패 시 원본 유지
  });

  it("다른 레인이 이미 쓰는 키로는 재배정할 수 없다", () => {
    const result = rebindKey(bindings, 0, "s", RESERVED_KEYS);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/이미 쓰는/);
  });

  it("자기 자신이 쓰던 키로 다시 배정하는 건 허용한다", () => {
    const result = rebindKey(bindings, 0, "a", RESERVED_KEYS);
    expect(result.ok).toBe(true);
  });
});
