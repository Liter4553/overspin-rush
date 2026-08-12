import type { BpmChange, Chart, ChartNote, NoteLane, NoteType } from "./types";

function isNoteLane(value: unknown): value is NoteLane {
  return value === 0 || value === 1 || value === 2 || value === "fx" || value === "scratch";
}

function isNoteType(value: unknown): value is NoteType {
  return value === "tap" || value === "hold";
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${path}는 객체여야 합니다.`);
  }
  return value as Record<string, unknown>;
}

function parseBpmChange(value: unknown, index: number): BpmChange {
  const item = asRecord(value, `bpmChanges[${index}]`);
  if (typeof item.time !== "number") throw new Error(`bpmChanges[${index}].time은 숫자여야 합니다.`);
  if (typeof item.bpm !== "number") throw new Error(`bpmChanges[${index}].bpm은 숫자여야 합니다.`);
  return { time: item.time, bpm: item.bpm };
}

function parseNote(value: unknown, index: number): ChartNote {
  const item = asRecord(value, `notes[${index}]`);
  if (typeof item.time !== "number") throw new Error(`notes[${index}].time은 숫자여야 합니다.`);
  if (!isNoteLane(item.lane)) throw new Error(`notes[${index}].lane 값이 올바르지 않습니다: ${String(item.lane)}`);
  if (!isNoteType(item.type)) throw new Error(`notes[${index}].type 값이 올바르지 않습니다: ${String(item.type)}`);
  if (item.type === "hold") {
    if (item.lane === "scratch") {
      throw new Error(`notes[${index}]: 스크래치 노트는 홀드를 지원하지 않습니다.`);
    }
    if (typeof item.duration !== "number") {
      throw new Error(`notes[${index}]는 홀드 노트인데 duration이 없습니다.`);
    }
    if (item.tickIntervalBeats !== undefined && typeof item.tickIntervalBeats !== "number") {
      throw new Error(`notes[${index}].tickIntervalBeats는 숫자여야 합니다.`);
    }
    return {
      time: item.time,
      lane: item.lane,
      type: item.type,
      duration: item.duration,
      tickIntervalBeats: item.tickIntervalBeats as number | undefined,
    };
  }
  return { time: item.time, lane: item.lane, type: item.type };
}

// 채보 JSON을 파싱하며 스키마를 런타임에 강제한다.
// 노트/BPM변경은 시간 오름차순으로 정렬해 게임 로직과 제작 툴이 정렬을 매번 다시 신경 쓰지 않게 한다.
export function parseChart(data: unknown): Chart {
  const raw = asRecord(data, "chart");

  if (typeof raw.title !== "string") throw new Error("title은 문자열이어야 합니다.");
  if (typeof raw.artist !== "string") throw new Error("artist는 문자열이어야 합니다.");
  if (typeof raw.audio !== "string") throw new Error("audio는 문자열이어야 합니다.");
  if (typeof raw.offset !== "number") throw new Error("offset은 숫자여야 합니다.");
  if (typeof raw.level !== "number") throw new Error("level은 숫자여야 합니다.");
  if (!Array.isArray(raw.bpmChanges)) throw new Error("bpmChanges는 배열이어야 합니다.");
  if (!Array.isArray(raw.notes)) throw new Error("notes는 배열이어야 합니다.");
  if (raw.holdTickIntervalBeats !== undefined && typeof raw.holdTickIntervalBeats !== "number") {
    throw new Error("holdTickIntervalBeats는 숫자여야 합니다.");
  }
  if (raw.beatsPerMeasure !== undefined) {
    if (typeof raw.beatsPerMeasure !== "number") throw new Error("beatsPerMeasure는 숫자여야 합니다.");
    if (!Number.isInteger(raw.beatsPerMeasure) || raw.beatsPerMeasure < 1) {
      throw new Error("beatsPerMeasure는 1 이상의 정수여야 합니다.");
    }
  }

  const bpmChanges = raw.bpmChanges
    .map(parseBpmChange)
    .sort((a, b) => a.time - b.time);

  const notes = raw.notes
    .map(parseNote)
    .sort((a, b) => a.time - b.time);

  const version = typeof raw.version === "number" ? raw.version : 1;

  return {
    version,
    title: raw.title,
    artist: raw.artist,
    audio: raw.audio,
    offset: raw.offset,
    bpmChanges,
    level: raw.level,
    holdTickIntervalBeats: raw.holdTickIntervalBeats as number | undefined,
    beatsPerMeasure: raw.beatsPerMeasure as number | undefined,
    notes,
  };
}
