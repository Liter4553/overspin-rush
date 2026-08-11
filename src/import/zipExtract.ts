// zip 파일(채보+음원 임포트, SPEC.md 7-1절)을 해제해 내부 파일 목록을 얻는다.
// 폴더 구조는 무시하고 파일명(마지막 경로 조각)만 남긴다 — 확장자로 자동 식별하는 다음 단계가 이를 사용.
import JSZip from "jszip";

export interface ExtractedFile {
  name: string;
  blob: Blob;
}

function baseName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

export async function extractZipFiles(zipData: Blob | ArrayBuffer): Promise<ExtractedFile[]> {
  const zip = await JSZip.loadAsync(zipData);
  const files: ExtractedFile[] = [];

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const blob = await entry.async("blob");
    files.push({ name: baseName(entry.name), blob });
  }

  return files;
}
