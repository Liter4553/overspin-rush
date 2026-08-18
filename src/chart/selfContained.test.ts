// src/chart/**는 게임 코드에 의존하지 않아야 한다.
//
// 채보 에디터가 이 폴더의 포맷 모듈을 통째로 복사해서 쓰기 때문이다(파서를 두 벌 만들면
// 포맷이 바뀔 때마다 양쪽을 수동으로 맞춰야 하고, 깜빡해도 아무데서도 실패하지 않는다).
// 누군가 무심코 `../config`나 `../core/...`를 import하면 에디터 쪽 빌드가 깨지므로 미리 막는다.
//
// 파일을 읽을 때 node:fs 대신 Vite의 ?raw glob을 쓴다 — @types/node 의존을 늘리지 않기 위해서.
import { describe, expect, it } from "vitest";

const sources = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

// import/export 구문의 모듈 경로만 뽑아낸다.
const MODULE_PATH_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+["']([^"']+)["']/g;

function moduleSpecifiersOf(source: string): string[] {
  return [...source.matchAll(MODULE_PATH_RE)].map((m) => m[1]);
}

// 테스트 파일은 vitest를 쓴다. 그 외의 외부 패키지에 의존하면 에디터가 복사해 갈 때 따라붙는다.
const ALLOWED_BARE = ["vitest"];

describe("src/chart 자립성", () => {
  const entries = Object.entries(sources);

  it("검사할 파일이 실제로 존재한다", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)("%s 는 chart 폴더 바깥을 import하지 않는다", (_path, source) => {
    const outside = moduleSpecifiersOf(source).filter((spec) => spec.startsWith("../"));
    expect(outside).toEqual([]);
  });

  it.each(entries)("%s 는 허용된 것 외의 외부 패키지를 import하지 않는다", (_path, source) => {
    const bare = moduleSpecifiersOf(source)
      .filter((spec) => !spec.startsWith("."))
      .filter((spec) => !ALLOWED_BARE.includes(spec));
    expect(bare).toEqual([]);
  });
});
