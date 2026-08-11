import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { loadImportedSongEntries } from "./importedSongEntries";
import { saveImportedSong, type ImportedSong } from "./songStorage";

const VALID_PATTERN = (title: string, level: number) => `
[meta]
title=${title}
artist=아티스트
audio=audio.ogg
offset=0
level=${level}

[bpm]
1:0=150

[notes]
1:0 0 tap
`;

function fakeSong(overrides: Partial<ImportedSong> = {}): ImportedSong {
  return {
    id: "song-1",
    title: "제목",
    artist: "아티스트",
    patternTextByDifficulty: { normal: VALID_PATTERN("제목", 6) },
    audioBlob: new Blob(["fake-audio"]),
    jacketBlob: undefined,
    importedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(async () => {
  const { indexedDB } = await import("fake-indexeddb");
  indexedDB.deleteDatabase("overspin-rush");
});

describe("loadImportedSongEntries", () => {
  it("저장된 곡을 SongEntry로 변환한다(레벨은 채보 파싱 결과에서 가져온다)", async () => {
    await saveImportedSong(fakeSong());

    const entries = await loadImportedSongEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("제목");
    expect(entries[0].levels.normal).toBe(6);
    expect(entries[0].chartRawByDifficulty.normal).toBeDefined();
    expect(entries[0].audioBlob).toBeDefined();
  });

  it("자켓 blob이 없으면 그라디언트로 폴백한다", async () => {
    await saveImportedSong(fakeSong());
    const [entry] = await loadImportedSongEntries();
    expect(entry.jacket.type).toBe("gradient");
  });

  it("자켓 blob이 있으면 objectURL 이미지로 표시한다", async () => {
    await saveImportedSong(fakeSong({ jacketBlob: new Blob(["fake-jacket"]) }));
    const [entry] = await loadImportedSongEntries();
    expect(entry.jacket.type).toBe("image");
  });

  it("난이도별로 파싱해 여러 난이도를 채운다", async () => {
    await saveImportedSong(
      fakeSong({
        patternTextByDifficulty: {
          easy: VALID_PATTERN("제목", 3),
          hard: VALID_PATTERN("제목", 9),
        },
      }),
    );
    const [entry] = await loadImportedSongEntries();
    expect(entry.levels).toEqual({ easy: 3, hard: 9 });
  });

  it("모든 난이도의 파싱이 실패하면 목록에서 제외한다", async () => {
    await saveImportedSong(fakeSong({ patternTextByDifficulty: { normal: "이건 채보가 아님" } }));
    const entries = await loadImportedSongEntries();
    expect(entries).toHaveLength(0);
  });

  it("importedAt 오름차순으로 정렬한다", async () => {
    await saveImportedSong(fakeSong({ id: "a", importedAt: 200 }));
    await saveImportedSong(fakeSong({ id: "b", importedAt: 100 }));
    const entries = await loadImportedSongEntries();
    expect(entries.map((e) => e.id)).toEqual(["b", "a"]);
  });
});
