// 압축 해제된 파일들을 확장자로 분류한다(채보/음원/자켓). 실제 오디오 파일명 매칭은
// 각 .pattern의 [meta] audio= 필드로 이뤄지므로(다음 단계) 여기서는 파일명으로만 버킷을 나눈다.
import type { ExtractedFile } from "./zipExtract";
import { DIFFICULTIES, type Difficulty } from "../chart/songList";

export interface ClassifiedImportFiles {
  patternFilesByDifficulty: Partial<Record<Difficulty, ExtractedFile>>;
  audioFilesByName: Record<string, ExtractedFile>;
  jacketFile?: ExtractedFile;
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export function classifyImportFiles(files: readonly ExtractedFile[]): ClassifiedImportFiles {
  const patternFilesByDifficulty: Partial<Record<Difficulty, ExtractedFile>> = {};
  const audioFilesByName: Record<string, ExtractedFile> = {};
  let jacketFile: ExtractedFile | undefined;

  for (const file of files) {
    const lowerName = file.name.toLowerCase();
    const ext = extensionOf(lowerName);

    if (ext === "pattern") {
      const difficulty = DIFFICULTIES.find((d) => lowerName.includes(d));
      if (!difficulty) {
        throw new Error(`.pattern 파일명에 난이도(easy/normal/hard)가 포함되어야 합니다: "${file.name}"`);
      }
      if (patternFilesByDifficulty[difficulty]) {
        throw new Error(`같은 난이도의 .pattern 파일이 여러 개 있습니다: "${difficulty}"`);
      }
      patternFilesByDifficulty[difficulty] = file;
    } else if (ext === "ogg") {
      audioFilesByName[file.name] = file;
    } else if (ext === "png" || ext === "jpg" || ext === "jpeg") {
      if (!jacketFile) jacketFile = file; // 여러 개면 첫 번째만 자켓으로 사용
    }
    // 그 외 확장자(제작 프로젝트 파일 등)는 무시
  }

  if (Object.keys(patternFilesByDifficulty).length === 0) {
    throw new Error(".pattern 채보 파일이 zip 안에 하나도 없습니다.");
  }
  if (Object.keys(audioFilesByName).length === 0) {
    throw new Error(".ogg 음원 파일이 zip 안에 하나도 없습니다.");
  }

  return { patternFilesByDifficulty, audioFilesByName, jacketFile };
}
