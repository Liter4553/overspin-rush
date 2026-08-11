import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extractZipFiles } from "./zipExtract";

// Node 테스트 환경엔 FileReader가 없어 JSZip이 Blob 입력을 읽지 못한다(브라우저에선 정상 동작).
// 그래서 테스트에서는 ArrayBuffer로 생성해 입력하고, extractZipFiles는 Blob/ArrayBuffer를 모두 받는다.
async function buildZipArrayBuffer(entries: Record<string, string>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("extractZipFiles", () => {
  it("zip 안의 파일들을 이름과 내용으로 복원한다", async () => {
    const zipData = await buildZipArrayBuffer({
      "chart_easy.pattern": "[meta]\ntitle=t",
      "audio.ogg": "fake-audio-bytes",
    });

    const files = await extractZipFiles(zipData);
    const names = files.map((f) => f.name).sort();
    expect(names).toEqual(["audio.ogg", "chart_easy.pattern"]);

    const patternFile = files.find((f) => f.name === "chart_easy.pattern")!;
    const text = await patternFile.blob.text();
    expect(text).toBe("[meta]\ntitle=t");
  });

  it("폴더 구조가 있어도 파일명만 남긴다", async () => {
    const zipData = await buildZipArrayBuffer({
      "song/chart_easy.pattern": "content",
    });

    const files = await extractZipFiles(zipData);
    expect(files.map((f) => f.name)).toEqual(["chart_easy.pattern"]);
  });

  it("디렉터리 엔트리는 결과에 포함하지 않는다", async () => {
    const zip = new JSZip();
    zip.folder("song");
    zip.file("song/chart_easy.pattern", "content");
    const zipData = await zip.generateAsync({ type: "arraybuffer" });

    const files = await extractZipFiles(zipData);
    expect(files.every((f) => f.name !== "")).toBe(true);
    expect(files.map((f) => f.name)).toEqual(["chart_easy.pattern"]);
  });
});
