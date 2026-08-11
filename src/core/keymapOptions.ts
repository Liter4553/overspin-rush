// 키 설정(레인 1/2/3/FX + 스크래치 업/다운) 순수 로직.
// resolveLaneFromKey(input/keyboard.ts)가 쓰는 Record<key, lane> 형태를 옵션 UI에서 직접
// 다루면 "이 슬롯은 지금 무슨 키냐"를 매번 역탐색해야 해서, 여기서는 Record<slot, key>
// (KeyBindings)로 다루고 필요할 때만 서로 변환한다.
import type { NoteLane } from "../chart/types";

export type BindableLane = 0 | 1 | 2 | "fx";
export const BINDABLE_LANES: readonly BindableLane[] = [0, 1, 2, "fx"];

// 스크래치는 레인과 달리 "업"/"다운" 두 방향을 각각 독립적으로 키 또는 마우스에 배정한다.
export type ScratchKeySlot = "scratchUp" | "scratchDown";
export const SCRATCH_KEY_SLOTS: readonly ScratchKeySlot[] = ["scratchUp", "scratchDown"];

export type BindableSlot = BindableLane | ScratchKeySlot;
export const ALL_BINDABLE_SLOTS: readonly BindableSlot[] = [...BINDABLE_LANES, ...SCRATCH_KEY_SLOTS];

// 실제 키보드 키가 아니라 "원래처럼 마우스 움직임을 인식"을 뜻하는 특수값.
// 실제 KeyboardEvent.key가 이 문자열과 같아질 일은 없어서 충돌 걱정 없이 구분자로 쓸 수 있다.
export const MOUSE_BINDING = "mouse";

export type KeyBindings = Record<BindableSlot, string>;

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

function isLaneSlot(slot: BindableSlot): slot is BindableLane {
  return slot === 0 || slot === 1 || slot === 2 || slot === "fx";
}

export function keymapToBindings(keymap: Readonly<Record<string, NoteLane>>): Record<BindableLane, string> {
  const bindings = {} as Record<BindableLane, string>;
  for (const [key, lane] of Object.entries(keymap)) {
    if (lane === "scratch") continue;
    bindings[lane] = key;
  }
  return bindings;
}

// 레인 키맵은 기본값(DEFAULT_KEYMAP)에서 가져오고, 스크래치는 항상 마우스로 시작한다
// (기존 동작을 그대로 유지 — 아무것도 안 바꾼 사용자에게는 이전과 똑같이 동작해야 한다).
export function createDefaultKeyBindings(defaultKeymap: Readonly<Record<string, NoteLane>>): KeyBindings {
  return {
    ...keymapToBindings(defaultKeymap),
    scratchUp: MOUSE_BINDING,
    scratchDown: MOUSE_BINDING,
  };
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

// slot에 rawKey(또는 스크래치 슬롯이라면 MOUSE_BINDING)를 새로 배정한다.
// - 예약된 키(일시정지/배속 변경 등)나 다른 슬롯이 이미 쓰는 키면 거부(자동 스왑 없음).
// - 레인 슬롯은 반드시 실제 키여야 한다(마우스로 설정 불가). 스크래치 슬롯만 마우스 허용.
// - MOUSE_BINDING은 여러 슬롯이 동시에 가질 수 있어(기본값이 둘 다 마우스) 충돌 검사에서 제외.
export function rebindKey(
  bindings: Readonly<KeyBindings>,
  slot: BindableSlot,
  rawKey: string,
  reservedKeys: readonly string[],
): RebindResult {
  if (rawKey === MOUSE_BINDING) {
    if (isLaneSlot(slot)) {
      return { bindings: bindings as KeyBindings, ok: false, reason: "레인은 마우스로 설정할 수 없습니다." };
    }
    return { bindings: { ...bindings, [slot]: MOUSE_BINDING }, ok: true };
  }

  const newKey = normalizeKey(rawKey);

  if (reservedKeys.some((reserved) => normalizeKey(reserved) === newKey)) {
    return { bindings: bindings as KeyBindings, ok: false, reason: "다른 기능에 이미 쓰이는 키입니다." };
  }

  const conflictSlot = ALL_BINDABLE_SLOTS.find(
    (s) => s !== slot && bindings[s] !== MOUSE_BINDING && normalizeKey(bindings[s]) === newKey,
  );
  if (conflictSlot !== undefined) {
    return { bindings: bindings as KeyBindings, ok: false, reason: "다른 항목이 이미 쓰는 키입니다." };
  }

  return { bindings: { ...bindings, [slot]: newKey }, ok: true };
}
