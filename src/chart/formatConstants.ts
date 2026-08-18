// .pattern 채보 포맷 자체를 정의하는 상수. 게임 설정(config.ts)이 아니라 포맷의 일부이므로
// chart 모듈 안에 둔다 — 이렇게 해야 chart/ 폴더가 게임 코드에 전혀 의존하지 않고,
// 채보 에디터 같은 다른 프로젝트가 이 폴더만 그대로 가져다 쓸 수 있다.
//
// 이 폴더(src/chart/**)는 외부 의존이 없어야 한다는 규칙을 지킬 것.

// 틱 해상도: 1틱 = 16분음표. 온음표 하나가 16틱이므로 마디당 틱 수는
// 박자표에서 분자 * (16 / 분모)로 유도된다.
export const TICKS_PER_WHOLE_NOTE = 16;

// 4분음표(1박) 하나에 들어가는 틱 수. ms 변환의 기준.
export const PATTERN_TICKS_PER_BEAT = TICKS_PER_WHOLE_NOTE / 4;

// 박자표 지정이 없을 때(또는 첫 변경 이전 마디에) 쓰는 기본 박자표.
export const DEFAULT_TIME_SIGNATURE = { numerator: 4, denominator: 4 } as const;

// 분모는 16틱(온음표)을 정수로 나누어떨어지게 하는 값만 허용한다 — 마디 길이가
// 정수 틱으로 떨어져야 마디:틱 표기가 성립하기 때문.
export const VALID_TIME_SIGNATURE_DENOMINATORS: readonly number[] = [1, 2, 4, 8, 16];
