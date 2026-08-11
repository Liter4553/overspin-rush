// 선곡 화면에 띄울 악곡 목록. 더미 3곡(테스트용, 전부 dummyChartRaw 공유)은 항상 고정으로
// 표시되고, 임포트한 곡(src/import/importedSongEntries.ts)이 그 뒤에 이어붙는다.
import { dummyChartRaw } from "./dummyChart";

export type Difficulty = "easy" | "normal" | "hard";

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

export const DIFFICULTY_LABEL: Readonly<Record<Difficulty, string>> = {
  easy: "EASY",
  normal: "NORMAL",
  hard: "HARD",
};

// 더미 곡은 실제 앨범아트가 없어 그라디언트로, 임포트한 곡은 zip 안 이미지(blob) 또는
// 기본 그라디언트로 표시한다.
export type JacketSpec = { type: "gradient"; colors: readonly [string, string] } | { type: "image"; objectUrl: string };

export interface SongEntry {
  id: string;
  title: string;
  artist: string;
  // 임포트한 곡은 zip에 들어있던 난이도만 있을 수 있다(전부 필수 아님).
  levels: Partial<Readonly<Record<Difficulty, number>>>;
  chartRawByDifficulty: Partial<Readonly<Record<Difficulty, unknown>>>;
  jacket: JacketSpec;
  audioBlob?: Blob; // 없으면(더미 채보) 무음으로 재생된다
}

export const SONG_LIST: readonly SongEntry[] = [
  {
    id: "dummy",
    title: dummyChartRaw.title,
    artist: dummyChartRaw.artist,
    levels: { easy: 3, normal: 6, hard: 9 },
    chartRawByDifficulty: { easy: dummyChartRaw, normal: dummyChartRaw, hard: dummyChartRaw },
    jacket: { type: "gradient", colors: ["#378ADD", "#5DCAA5"] },
  },
  {
    id: "dummy2",
    title: "테스트 채보 B",
    artist: "Test Artist B",
    levels: { easy: 2, normal: 5, hard: 8 },
    chartRawByDifficulty: { easy: dummyChartRaw, normal: dummyChartRaw, hard: dummyChartRaw },
    jacket: { type: "gradient", colors: ["#FD79A8", "#6C5CE7"] },
  },
  {
    id: "dummy3",
    title: "테스트 채보 C",
    artist: "Test Artist C",
    levels: { easy: 4, normal: 7, hard: 10 },
    chartRawByDifficulty: { easy: dummyChartRaw, normal: dummyChartRaw, hard: dummyChartRaw },
    jacket: { type: "gradient", colors: ["#FFA94D", "#FA5252"] },
  },
];
