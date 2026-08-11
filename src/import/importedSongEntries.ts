// IndexedDB에 저장된 ImportedSong들을 선곡 화면이 바로 쓸 수 있는 SongEntry[]로 변환한다.
// .pattern 텍스트 파싱은 항상 여기서(불러올 때마다) 수행해 저장 형식과 파서를 분리해둔다.
import { getAllImportedSongs, type ImportedSong } from "./songStorage";
import { parsePattern } from "../chart/patternParser";
import { DIFFICULTIES, type Difficulty, type SongEntry } from "../chart/songList";

// 이전에 만들어둔 자켓 objectURL을 계속 들고 있으면 메모리 누수이므로, 새로고침할 때마다 정리한다.
let activeJacketObjectUrls: string[] = [];

function revokeActiveJacketObjectUrls(): void {
  for (const url of activeJacketObjectUrls) URL.revokeObjectURL(url);
  activeJacketObjectUrls = [];
}

function toSongEntry(song: ImportedSong): SongEntry | null {
  const levels: Partial<Record<Difficulty, number>> = {};
  const chartRawByDifficulty: Partial<Record<Difficulty, unknown>> = {};

  for (const difficulty of DIFFICULTIES) {
    const text = song.patternTextByDifficulty[difficulty];
    if (text === undefined) continue;
    try {
      const chart = parsePattern(text);
      levels[difficulty] = chart.level;
      chartRawByDifficulty[difficulty] = chart;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`임포트된 곡 "${song.title}"의 ${difficulty} 채보를 불러오지 못했습니다: ${message}`);
    }
  }

  if (Object.keys(chartRawByDifficulty).length === 0) return null;

  const jacketObjectUrl = song.jacketBlob ? URL.createObjectURL(song.jacketBlob) : null;
  if (jacketObjectUrl) activeJacketObjectUrls.push(jacketObjectUrl);

  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    levels,
    chartRawByDifficulty,
    jacket: jacketObjectUrl
      ? { type: "image", objectUrl: jacketObjectUrl }
      : { type: "gradient", colors: ["#4B5563", "#1F2937"] },
    audioBlob: song.audioBlob,
  };
}

export async function loadImportedSongEntries(): Promise<SongEntry[]> {
  revokeActiveJacketObjectUrls();
  const songs = await getAllImportedSongs();
  const entries: SongEntry[] = [];
  for (const song of songs.sort((a, b) => a.importedAt - b.importedAt)) {
    const entry = toSongEntry(song);
    if (entry !== null) entries.push(entry);
  }
  return entries;
}
