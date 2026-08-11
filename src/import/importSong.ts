// zip 파일 하나를 실제 게임에서 쓸 수 있는 임포트된 곡(ImportedSong)으로 만드는 오케스트레이션.
// 압축 해제 -> 확장자별 분류 -> 난이도별 .pattern 파싱/검증 -> IndexedDB 저장까지 잇는다.
import { extractZipFiles, type ExtractedFile } from "./zipExtract";
import { classifyImportFiles, type ClassifiedImportFiles } from "./classifyImportFiles";
import { parsePattern } from "../chart/patternParser";
import { saveImportedSong, type ImportedSong } from "./songStorage";
import { DIFFICULTIES, type Difficulty } from "../chart/songList";
import type { Chart } from "../chart/types";

interface ParsedDifficulty {
  difficulty: Difficulty;
  text: string;
  chart: Chart;
}

async function parseDifficulties(classified: ClassifiedImportFiles): Promise<ParsedDifficulty[]> {
  const parsed: ParsedDifficulty[] = [];
  for (const difficulty of DIFFICULTIES) {
    const file = classified.patternFilesByDifficulty[difficulty];
    if (!file) continue;
    const text = await file.blob.text();
    try {
      parsed.push({ difficulty, text, chart: parsePattern(text) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${difficulty} 채보(${file.name}) 파싱 실패: ${message}`);
    }
  }
  return parsed;
}

function assertConsistentMeta(parsed: readonly ParsedDifficulty[]): void {
  const [first, ...rest] = parsed;
  for (const p of rest) {
    if (p.chart.title !== first.chart.title || p.chart.artist !== first.chart.artist || p.chart.audio !== first.chart.audio) {
      throw new Error(
        `난이도별 채보의 title/artist/audio가 서로 일치해야 합니다: ` +
          `${first.difficulty}="${first.chart.title}/${first.chart.artist}/${first.chart.audio}" vs ` +
          `${p.difficulty}="${p.chart.title}/${p.chart.artist}/${p.chart.audio}"`,
      );
    }
  }
}

function findAudioFile(classified: ClassifiedImportFiles, audioFileName: string): ExtractedFile | undefined {
  const lowerTarget = audioFileName.toLowerCase();
  const match = Object.entries(classified.audioFilesByName).find(([name]) => name.toLowerCase() === lowerTarget);
  return match?.[1];
}

export async function importSongFromZip(zipData: Blob | ArrayBuffer): Promise<ImportedSong> {
  const files = await extractZipFiles(zipData);
  const classified = classifyImportFiles(files);
  const parsedDifficulties = await parseDifficulties(classified);
  assertConsistentMeta(parsedDifficulties);

  const { title, artist, audio: audioFileName } = parsedDifficulties[0].chart;
  const audioFile = findAudioFile(classified, audioFileName);
  if (!audioFile) {
    throw new Error(`채보가 참조하는 음원 파일을 zip에서 찾을 수 없습니다: "${audioFileName}"`);
  }

  const patternTextByDifficulty: Partial<Record<Difficulty, string>> = {};
  for (const parsed of parsedDifficulties) {
    patternTextByDifficulty[parsed.difficulty] = parsed.text;
  }

  const importedSong: ImportedSong = {
    id: crypto.randomUUID(),
    title,
    artist,
    patternTextByDifficulty,
    audioBlob: audioFile.blob,
    jacketBlob: classified.jacketFile?.blob,
    importedAt: Date.now(),
  };

  await saveImportedSong(importedSong);
  return importedSong;
}
