import type { NoteLane } from "../chart/types";

// event.key(대소문자 무관)를 키맵으로 레인에 매핑한다. 매핑이 없으면 null(무시).
export function resolveLaneFromKey(
  key: string,
  keymap: Readonly<Record<string, NoteLane>>,
): NoteLane | null {
  const lane = keymap[key.toLowerCase()];
  return lane === undefined ? null : lane;
}
