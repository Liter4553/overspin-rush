// .pattern 채보 텍스트(SPEC.md 7-1절) 파서.
// [meta]/[bpm]/[notes] 섹션의 마디:틱 표기를 ms로 변환한 뒤 parseChart에 검증을 위임해
// JSON 채보와 완전히 동일한 내부 스키마(Chart)를 만든다.
import type { Chart, NoteLane, NoteType } from "./types";
import { parseChart } from "./parseChart";
import { absoluteTickToMs, barTickToAbsoluteTick, type BarTick, type TickBpmChange } from "./barTick";

const SECTION_HEADER = /^\[(\w+)\]$/;
const REQUIRED_META_KEYS = ["title", "artist", "audio", "offset", "level"] as const;

function stripComment(line: string): string {
  const index = line.indexOf("#");
  return index === -1 ? line : line.slice(0, index);
}

function splitSections(text: string): Record<string, string[]> {
  const sections: Record<string, string[]> = {};
  let current: string | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (line === "") continue;

    const headerMatch = SECTION_HEADER.exec(line);
    if (headerMatch) {
      current = headerMatch[1].toLowerCase();
      sections[current] = [];
      continue;
    }
    if (current === null) {
      throw new Error(`섹션 헤더([meta] 등) 없이 내용이 나왔습니다: "${line}"`);
    }
    sections[current].push(line);
  }
  return sections;
}

function parseBarTick(value: string, context: string): BarTick {
  const match = /^(\d+):(\d+)$/.exec(value);
  if (!match) throw new Error(`${context}: 마디:틱 형식이 아닙니다: "${value}"`);
  const bar = Number(match[1]);
  const tick = Number(match[2]);
  if (bar < 1) throw new Error(`${context}: 마디는 1 이상이어야 합니다: "${value}"`);
  return { bar, tick };
}

function parseMeta(lines: string[]): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const line of lines) {
    const eq = line.indexOf("=");
    if (eq === -1) throw new Error(`[meta]: key=value 형식이 아닙니다: "${line}"`);
    meta[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return meta;
}

function parseBpmSection(lines: string[]): TickBpmChange[] {
  if (lines.length === 0) throw new Error("[bpm] 섹션에는 최소 1개의 BPM이 필요합니다.");

  const changes = lines.map((line) => {
    const eq = line.indexOf("=");
    if (eq === -1) throw new Error(`[bpm]: 마디:틱=BPM 형식이 아닙니다: "${line}"`);
    const barTick = parseBarTick(line.slice(0, eq).trim(), "[bpm]");
    const bpm = Number(line.slice(eq + 1).trim());
    if (!Number.isFinite(bpm) || bpm <= 0) throw new Error(`[bpm]: BPM 값이 올바르지 않습니다: "${line}"`);
    return { tick: barTickToAbsoluteTick(barTick), bpm };
  });

  return changes.sort((a, b) => a.tick - b.tick);
}

function toNoteLane(token: string, context: string): NoteLane {
  if (token === "0" || token === "1" || token === "2") return Number(token) as 0 | 1 | 2;
  if (token === "fx" || token === "scratch") return token;
  throw new Error(`${context}: lane 값이 올바르지 않습니다: "${token}"`);
}

function toNoteType(token: string, context: string): NoteType {
  if (token === "tap" || token === "hold") return token;
  throw new Error(`${context}: type 값이 올바르지 않습니다: "${token}"`);
}

interface PatternNote {
  time: number;
  lane: NoteLane;
  type: NoteType;
  duration?: number;
}

function parseNotesSection(lines: string[], tickBpmChanges: TickBpmChange[]): PatternNote[] {
  return lines.map((line, index) => {
    const context = `[notes] 줄 ${index + 1}`;
    const tokens = line.split(/\s+/);
    if (tokens.length < 3 || tokens.length > 4) {
      throw new Error(`${context}: "마디:틱 레인 타입 [duration]" 형식이 아닙니다: "${line}"`);
    }
    const [barTickToken, laneToken, typeToken, durationToken] = tokens;
    const barTick = parseBarTick(barTickToken, context);
    const lane = toNoteLane(laneToken, context);
    const type = toNoteType(typeToken, context);
    const absoluteTick = barTickToAbsoluteTick(barTick);
    const time = absoluteTickToMs(absoluteTick, tickBpmChanges);

    if (type === "hold") {
      if (lane === "scratch") throw new Error(`${context}: 스크래치 노트는 홀드를 지원하지 않습니다.`);
      if (durationToken === undefined) throw new Error(`${context}: 홀드 노트는 duration(틱)이 필요합니다.`);
      const durationTicks = Number(durationToken);
      if (!Number.isInteger(durationTicks) || durationTicks <= 0) {
        throw new Error(`${context}: duration은 양의 정수(틱)여야 합니다: "${durationToken}"`);
      }
      const endMs = absoluteTickToMs(absoluteTick + durationTicks, tickBpmChanges);
      return { time, lane, type, duration: endMs - time };
    }

    if (durationToken !== undefined) {
      throw new Error(`${context}: tap 노트에는 duration을 붙일 수 없습니다.`);
    }
    return { time, lane, type };
  });
}

export function parsePattern(text: string): Chart {
  const sections = splitSections(text);
  if (!sections.meta) throw new Error("[meta] 섹션이 없습니다.");
  if (!sections.bpm) throw new Error("[bpm] 섹션이 없습니다.");
  if (!sections.notes) throw new Error("[notes] 섹션이 없습니다.");

  const meta = parseMeta(sections.meta);
  for (const key of REQUIRED_META_KEYS) {
    if (meta[key] === undefined) throw new Error(`[meta]: "${key}" 필드가 필요합니다.`);
  }

  const tickBpmChanges = parseBpmSection(sections.bpm);
  const notes = parseNotesSection(sections.notes, tickBpmChanges);
  const bpmChanges = tickBpmChanges.map((change) => ({
    time: absoluteTickToMs(change.tick, tickBpmChanges),
    bpm: change.bpm,
  }));

  return parseChart({
    title: meta.title,
    artist: meta.artist,
    audio: meta.audio,
    offset: Number(meta.offset),
    level: Number(meta.level),
    bpmChanges,
    notes,
  });
}
