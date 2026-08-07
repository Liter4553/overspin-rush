// 선곡 화면에 띄울 악곡 목록. 지금은 테스트용 더미 채보 하나뿐이라 난이도 3개가
// 전부 같은 채보를 가리킨다 — 난이도별로 실제 다른 채보를 붙이는 건 추후 확장 지점.
import { dummyChartRaw } from "./dummyChart";

export type Difficulty = "easy" | "normal" | "hard";

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

export const DIFFICULTY_LABEL: Readonly<Record<Difficulty, string>> = {
  easy: "EASY",
  normal: "NORMAL",
  hard: "HARD",
};

export interface SongEntry {
  id: string;
  title: string;
  artist: string;
  levels: Readonly<Record<Difficulty, number>>;
  chartRaw: unknown;
}

export const SONG_LIST: readonly SongEntry[] = [
  {
    id: "dummy",
    title: dummyChartRaw.title,
    artist: dummyChartRaw.artist,
    levels: { easy: 3, normal: 6, hard: 9 },
    chartRaw: dummyChartRaw,
  },
];
