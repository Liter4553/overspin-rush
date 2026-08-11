import { describe, expect, it } from "vitest";
import { classifyImportFiles } from "./classifyImportFiles";
import type { ExtractedFile } from "./zipExtract";

function fakeFile(name: string): ExtractedFile {
  return { name, blob: new Blob(["dummy"]) };
}

describe("classifyImportFiles", () => {
  it("난이도별 .pattern, .ogg, 자켓 이미지를 각 버킷으로 분류한다", () => {
    const files = [
      fakeFile("chart_easy.pattern"),
      fakeFile("chart_normal.pattern"),
      fakeFile("chart_hard.pattern"),
      fakeFile("audio.ogg"),
      fakeFile("jacket.png"),
    ];
    const result = classifyImportFiles(files);
    expect(Object.keys(result.patternFilesByDifficulty).sort()).toEqual(["easy", "hard", "normal"]);
    expect(result.audioFilesByName["audio.ogg"]).toBeDefined();
    expect(result.jacketFile?.name).toBe("jacket.png");
  });

  it("대소문자를 구분하지 않고 확장자를 인식한다", () => {
    const files = [fakeFile("CHART_EASY.PATTERN"), fakeFile("Audio.OGG")];
    const result = classifyImportFiles(files);
    expect(result.patternFilesByDifficulty.easy).toBeDefined();
    expect(result.audioFilesByName["Audio.OGG"]).toBeDefined();
  });

  it("자켓 이미지가 여러 개면 첫 번째만 사용한다", () => {
    const files = [fakeFile("chart_easy.pattern"), fakeFile("audio.ogg"), fakeFile("a.jpg"), fakeFile("b.png")];
    const result = classifyImportFiles(files);
    expect(result.jacketFile?.name).toBe("a.jpg");
  });

  it("파일명에 난이도가 없는 .pattern 파일이면 에러를 던진다", () => {
    const files = [fakeFile("chart.pattern"), fakeFile("audio.ogg")];
    expect(() => classifyImportFiles(files)).toThrow();
  });

  it("같은 난이도의 .pattern 파일이 중복되면 에러를 던진다", () => {
    const files = [fakeFile("chart_easy.pattern"), fakeFile("chart_easy_v2.pattern"), fakeFile("audio.ogg")];
    expect(() => classifyImportFiles(files)).toThrow();
  });

  it(".pattern 파일이 하나도 없으면 에러를 던진다", () => {
    expect(() => classifyImportFiles([fakeFile("audio.ogg")])).toThrow();
  });

  it(".ogg 파일이 하나도 없으면 에러를 던진다", () => {
    expect(() => classifyImportFiles([fakeFile("chart_easy.pattern")])).toThrow();
  });

  it("폴더 경로/무관한 확장자는 무시한다", () => {
    const files = [fakeFile("chart_easy.pattern"), fakeFile("audio.ogg"), fakeFile("sync.rpp"), fakeFile("readme.txt")];
    const result = classifyImportFiles(files);
    expect(result.patternFilesByDifficulty.easy).toBeDefined();
  });
});
