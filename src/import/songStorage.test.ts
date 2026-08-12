import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteImportedSong, getAllImportedSongs, getImportedSong, saveImportedSong, type ImportedSong } from "./songStorage";

function fakeSong(id: string): ImportedSong {
  return {
    id,
    title: `제목-${id}`,
    artist: "아티스트",
    patternTextByDifficulty: { normal: "[meta]\ntitle=t" },
    audioBlob: new Blob(["fake-audio"]),
    jacketBlob: new Blob(["fake-jacket"]),
    importedAt: Date.now(),
  };
}

beforeEach(async () => {
  // 매 테스트마다 fake-indexeddb 스토리지를 초기화한다.
  const { indexedDB } = await import("fake-indexeddb");
  indexedDB.deleteDatabase("overspin-rush");
});

describe("songStorage", () => {
  it("저장한 곡을 id로 조회할 수 있다", async () => {
    const song = fakeSong("song-1");
    await saveImportedSong(song);

    const loaded = await getImportedSong("song-1");
    expect(loaded?.title).toBe("제목-song-1");
    expect(loaded?.patternTextByDifficulty.normal).toBe("[meta]\ntitle=t");
  });

  it("존재하지 않는 id를 조회하면 undefined를 반환한다", async () => {
    const loaded = await getImportedSong("no-such-id");
    expect(loaded).toBeUndefined();
  });

  it("저장한 모든 곡을 목록으로 조회할 수 있다", async () => {
    await saveImportedSong(fakeSong("song-1"));
    await saveImportedSong(fakeSong("song-2"));

    const all = await getAllImportedSongs();
    expect(all.map((s) => s.id).sort()).toEqual(["song-1", "song-2"]);
  });

  it("같은 id로 다시 저장하면 덮어쓴다", async () => {
    await saveImportedSong(fakeSong("song-1"));
    const updated = { ...fakeSong("song-1"), title: "새 제목" };
    await saveImportedSong(updated);

    const all = await getAllImportedSongs();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("새 제목");
  });

  it("삭제한 곡은 목록과 조회에서 사라진다", async () => {
    await saveImportedSong(fakeSong("song-1"));
    await saveImportedSong(fakeSong("song-2"));

    await deleteImportedSong("song-1");

    expect(await getImportedSong("song-1")).toBeUndefined();
    const all = await getAllImportedSongs();
    expect(all.map((s) => s.id)).toEqual(["song-2"]);
  });

  it("존재하지 않는 id를 삭제해도 에러가 나지 않는다", async () => {
    await expect(deleteImportedSong("no-such-id")).resolves.toBeUndefined();
  });
});
