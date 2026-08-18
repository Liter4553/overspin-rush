import type { BpmChange, Chart, ChartNote, NoteLane, NoteType, TickBpmChange } from "./types";
import { isValidDenominator, type TimeSignature } from "./timeSignature";
import { msToAbsoluteTick } from "./barTick";
import { PATTERN_TICKS_PER_BEAT } from "../config";

function parseTickBpmChange(value: unknown, index: number): TickBpmChange {
  const item = asRecord(value, `bpmChangeTicks[${index}]`);
  if (typeof item.tick !== "number") throw new Error(`bpmChangeTicks[${index}].tick은 숫자여야 합니다.`);
  if (typeof item.bpm !== "number") throw new Error(`bpmChangeTicks[${index}].bpm은 숫자여야 합니다.`);
  return { tick: item.tick, bpm: item.bpm };
}

// ms 기준 BPM 목록을 틱 기준으로 환산한다. 각 구간의 ms 길이를 그 구간 BPM의 틱 길이로
// 나눠 누적하므로, 구간 경계가 틱 공간에서도 정확히 보존된다.
function msBpmChangesToTickBpmChanges(bpmChanges: readonly BpmChange[]): TickBpmChange[] {
  const result: TickBpmChange[] = [];
  let tick = 0;

  bpmChanges.forEach((change, index) => {
    if (index > 0) {
      const prev = bpmChanges[index - 1];
      const msPerTick = 60000 / prev.bpm / PATTERN_TICKS_PER_BEAT;
      tick += (change.time - prev.time) / msPerTick;
    }
    result.push({ tick, bpm: change.bpm });
  });

  return result;
}

function parseTimeSignature(value: unknown, index: number): TimeSignature {
  const item = asRecord(value, `timeSignatures[${index}]`);
  if (!Number.isInteger(item.bar) || (item.bar as number) < 1) {
    throw new Error(`timeSignatures[${index}].bar는 1 이상의 정수여야 합니다.`);
  }
  if (!Number.isInteger(item.numerator) || (item.numerator as number) < 1) {
    throw new Error(`timeSignatures[${index}].numerator는 1 이상의 정수여야 합니다.`);
  }
  if (typeof item.denominator !== "number" || !isValidDenominator(item.denominator)) {
    throw new Error(
      `timeSignatures[${index}].denominator는 1/2/4/8/16 중 하나여야 합니다: ${String(item.denominator)}`,
    );
  }
  return { bar: item.bar as number, numerator: item.numerator as number, denominator: item.denominator };
}

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
      tick: typeof item.tick === "number" ? item.tick : undefined,
      lane: item.lane,
      type: item.type,
      duration: item.duration,
      tickIntervalBeats: item.tickIntervalBeats as number | undefined,
    };
  }
  return {
    time: item.time,
    tick: typeof item.tick === "number" ? item.tick : undefined,
    lane: item.lane,
    type: item.type,
  };
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
  if (raw.timeSignatures !== undefined && !Array.isArray(raw.timeSignatures)) {
    throw new Error("timeSignatures는 배열이어야 합니다.");
  }

  const bpmChanges = raw.bpmChanges
    .map(parseBpmChange)
    .sort((a, b) => a.time - b.time);

  const parsedNotes = raw.notes
    .map(parseNote)
    .sort((a, b) => a.time - b.time);

  const timeSignatures = (Array.isArray(raw.timeSignatures) ? raw.timeSignatures : [])
    .map(parseTimeSignature)
    .sort((a, b) => a.bar - b.bar);

  // .pattern에서 온 채보는 틱 기준 BPM 목록을 그대로 넘겨준다(정확한 원본).
  // ms만 있는 JSON 채보는 ms 구간 길이를 틱으로 환산해 만든다.
  const bpmChangeTicks = Array.isArray(raw.bpmChangeTicks)
    ? raw.bpmChangeTicks.map(parseTickBpmChange).sort((a, b) => a.tick - b.tick)
    : msBpmChangesToTickBpmChanges(bpmChanges);

  // 박자 기준 계산(홀드 틱 등)이 ms를 되돌리지 않아도 되도록, tick이 없는 노트는 여기서 채운다.
  // .pattern에서 온 노트는 이미 정확한 정수 틱을 갖고 있으므로 그대로 둔다.
  const notes = parsedNotes.map((note) =>
    note.tick === undefined ? { ...note, tick: msToAbsoluteTick(note.time, bpmChangeTicks) } : note,
  );

  const version = typeof raw.version === "number" ? raw.version : 1;

  return {
    version,
    title: raw.title,
    artist: raw.artist,
    audio: raw.audio,
    offset: raw.offset,
    bpmChanges,
    bpmChangeTicks,
    level: raw.level,
    holdTickIntervalBeats: raw.holdTickIntervalBeats as number | undefined,
    timeSignatures,
    notes,
  };
}
