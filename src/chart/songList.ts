// 선곡 화면에 띄울 악곡 목록. 지금은 테스트용 더미 채보 하나만 실제로 존재해서
// 모든 곡이 같은 채보를 가리킨다 — 곡/난이도별로 실제 다른 채보를 붙이는 건 추후 확장 지점.
// 리스트 -> 팝업 바인딩(곡을 눌렀을 때 아래 정보가 바뀌는지)을 확인하려고 곡을 3개로 늘려뒀다.
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
  jacketColors: readonly [string, string]; // 실제 앨범아트가 없어서 곡마다 다른 그라디언트로 구분
}

export const SONG_LIST: readonly SongEntry[] = [
  {
    id: "dummy",
    title: dummyChartRaw.title,
    artist: dummyChartRaw.artist,
    levels: { easy: 3, normal: 6, hard: 9 },
    chartRaw: dummyChartRaw,
    jacketColors: ["#378ADD", "#5DCAA5"],
  },
  {
    id: "dummy2",
    title: "테스트 채보 B",
    artist: "Test Artist B",
    levels: { easy: 2, normal: 5, hard: 8 },
    chartRaw: dummyChartRaw,
    jacketColors: ["#FD79A8", "#6C5CE7"],
  },
  {
    id: "dummy3",
    title: "테스트 채보 C",
    artist: "Test Artist C",
    levels: { easy: 4, normal: 7, hard: 10 },
    chartRaw: dummyChartRaw,
    jacketColors: ["#FFA94D", "#FA5252"],
  },
];
