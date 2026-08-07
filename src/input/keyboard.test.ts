import { describe, expect, it } from "vitest";
import { resolveLaneFromKey } from "./keyboard";
import { DEFAULT_KEYMAP } from "../config";

describe("resolveLaneFromKey", () => {
  it("a/s/d를 레인 0/1/2로 매핑한다", () => {
    expect(resolveLaneFromKey("a", DEFAULT_KEYMAP)).toBe(0);
    expect(resolveLaneFromKey("s", DEFAULT_KEYMAP)).toBe(1);
    expect(resolveLaneFromKey("d", DEFAULT_KEYMAP)).toBe(2);
  });

  it("대문자 입력도 동일하게 매핑한다", () => {
    expect(resolveLaneFromKey("A", DEFAULT_KEYMAP)).toBe(0);
  });

  it("매핑되지 않은 키는 null을 반환한다", () => {
    expect(resolveLaneFromKey("q", DEFAULT_KEYMAP)).toBeNull();
  });

  it("Space를 FX 레인으로 매핑한다", () => {
    expect(resolveLaneFromKey(" ", DEFAULT_KEYMAP)).toBe("fx");
  });
});
