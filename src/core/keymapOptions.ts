// 키보드 레인(A/S/D/FX) 배정 순수 로직. 스크래치는 마우스 전용이라 대상이 아니다.
// resolveLaneFromKey(input/keyboard.ts)가 쓰는 Record<key, lane> 형태를 옵션 UI에서 직접
// 다루면 "이 레인은 지금 무슨 키냐"를 매번 역탐색해야 해서, 여기서는 Record<lane, key>
// (KeyBindings)로 다루고 필요할 때만 서로 변환한다.
import type { NoteLane } from "../chart/types";

export type BindableLane = 0 | 1 | 2 | "fx";
export type KeyBindings = Record<BindableLane, string>;

export const BINDABLE_LANES: readonly BindableLane[] = [0, 1, 2, "fx"];

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

export function keymapToBindings(keymap: Readonly<Record<string, NoteLane>>): KeyBindings {
  const bindings = {} as KeyBindings;
  for (const [key, lane] of Object.entries(keymap)) {
    if (lane === "scratch") continue;
    bindings[lane] = key;
  }
  return bindings;
}

export function bindingsToKeymap(bindings: Readonly<KeyBindings>): Record<string, NoteLane> {
  const keymap: Record<string, NoteLane> = {};
  for (const lane of BINDABLE_LANES) {
    keymap[normalizeKey(bindings[lane])] = lane;
  }
  return keymap;
}

export interface RebindResult {
  bindings: KeyBindings;
  ok: boolean;
  reason?: string;
}

// lane에 rawKey를 새로 배정한다. 예약된 키(일시정지/배속 변경 등)나 다른 레인이 이미 쓰는
// 키면 거부한다 — 충돌 시 자동으로 스왑하지 않고, 사용자가 그 레인을 먼저 바꾸게 한다.
export function rebindKey(
  bindings: Readonly<KeyBindings>,
  lane: BindableLane,
  rawKey: string,
  reservedKeys: readonly string[],
): RebindResult {
  const newKey = normalizeKey(rawKey);

  if (reservedKeys.some((reserved) => normalizeKey(reserved) === newKey)) {
    return { bindings: bindings as KeyBindings, ok: false, reason: "다른 기능에 이미 쓰이는 키입니다." };
  }

  const conflictLane = BINDABLE_LANES.find((l) => l !== lane && normalizeKey(bindings[l]) === newKey);
  if (conflictLane !== undefined) {
    return { bindings: bindings as KeyBindings, ok: false, reason: "다른 레인이 이미 쓰는 키입니다." };
  }

  return { bindings: { ...bindings, [lane]: newKey }, ok: true };
}
