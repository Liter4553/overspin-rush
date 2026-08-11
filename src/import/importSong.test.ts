import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import JSZip from "jszip";
import { importSongFromZip } from "./importSong";
import { getImportedSong } from "./songStorage";

const EASY_PATTERN = `
[meta]
title=테스트곡
artist=테스터
audio=audio.ogg
offset=0
level=3

[bpm]
1:0=150

[notes]
1:0 0 tap
`;

const NORMAL_PATTERN = `
[meta]
title=테스트곡
artist=테스터
audio=audio.ogg
offset=0
level=6

[bpm]
1:0=150

[notes]
1:0 0 tap
1:4 1 tap
`;

async function buildZipArrayBuffer(entries: Record<string, string>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

beforeEach(async () => {
  const { indexedDB } = await import("fake-indexeddb");
  indexedDB.deleteDatabase("overspin-rush");
});

describe("importSongFromZip", () => {
  it("난이도별 .pattern + 음원 + 자켓을 파싱해 ImportedSong으로 저장한다", async () => {
    const zipData = await buildZipArrayBuffer({
      "chart_easy.pattern": EASY_PATTERN,
      "chart_normal.pattern": NORMAL_PATTERN,
      "audio.ogg": "fake-audio-bytes",
      "jacket.jpg": "fake-jacket-bytes",
    });

    const imported = await importSongFromZip(zipData);

    expect(imported.title).toBe("테스트곡");
    expect(imported.artist).toBe("테스터");
    expect(Object.keys(imported.patternTextByDifficulty).sort()).toEqual(["easy", "normal"]);
    expect(await imported.audioBlob.text()).toBe("fake-audio-bytes");
    expect(await imported.jacketBlob?.text()).toBe("fake-jacket-bytes");

    const saved = await getImportedSong(imported.id);
    expect(saved?.title).toBe("테스트곡");
  });

  it("자켓 없이도 임포트할 수 있다", async () => {
    const zipData = await buildZipArrayBuffer({
      "chart_easy.pattern": EASY_PATTERN,
      "audio.ogg": "fake-audio-bytes",
    });

    const imported = await importSongFromZip(zipData);
    expect(imported.jacketBlob).toBeUndefined();
  });

  it("meta의 audio 파일명이 zip에 없으면 에러를 던진다", async () => {
    const zipData = await buildZipArrayBuffer({
      "chart_easy.pattern": EASY_PATTERN,
      "other.ogg": "fake-audio-bytes",
    });

    await expect(importSongFromZip(zipData)).rejects.toThrow(/음원 파일을 zip에서 찾을 수 없습니다/);
  });

  it("난이도별 채보의 title/artist가 다르면 에러를 던진다", async () => {
    const mismatched = NORMAL_PATTERN.replace("title=테스트곡", "title=다른곡");
    const zipData = await buildZipArrayBuffer({
      "chart_easy.pattern": EASY_PATTERN,
      "chart_normal.pattern": mismatched,
      "audio.ogg": "fake-audio-bytes",
    });

    await expect(importSongFromZip(zipData)).rejects.toThrow(/서로 일치해야 합니다/);
  });

  it(".pattern 파싱에 실패하면 어떤 난이도인지 알려주는 에러를 던진다", async () => {
    const zipData = await buildZipArrayBuffer({
      "chart_easy.pattern": "이건 채보가 아님",
      "audio.ogg": "fake-audio-bytes",
    });

    await expect(importSongFromZip(zipData)).rejects.toThrow(/easy 채보/);
  });

  it("음원 파일명 대소문자가 달라도 매칭한다", async () => {
    const zipData = await buildZipArrayBuffer({
      "chart_easy.pattern": EASY_PATTERN,
      "AUDIO.OGG": "fake-audio-bytes",
    });

    const imported = await importSongFromZip(zipData);
    expect(await imported.audioBlob.text()).toBe("fake-audio-bytes");
  });
});
