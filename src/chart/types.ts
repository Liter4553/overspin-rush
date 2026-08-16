// 채보 JSON 스키마. 게임 본체와 (추후 만들) 채보 제작 툴이 공유하는 타입이므로
// 필드를 늘릴 땐 항상 optional로 추가하고 version을 올려서 하위 호환을 유지한다.
import type { TimeSignature } from "./timeSignature";

export type { TimeSignature };

export type NoteLane = 0 | 1 | 2 | "fx" | "scratch";
export type NoteType = "tap" | "hold";

export interface ChartNote {
  time: number; // ms, 오디오 시작 기준
  lane: NoteLane;
  type: NoteType;
  duration?: number; // ms, hold 노트에서만 사용
  tickIntervalBeats?: number; // 선택. hold 노트별 홀드 틱 간격(비트) 오버라이드
}

export interface BpmChange {
  time: number; // ms
  bpm: number;
}

export interface Chart {
  version: number; // 스키마 버전. 제작 툴이 저장 파일을 읽을 때 마이그레이션 기준으로 사용
  title: string;
  artist: string;
  audio: string;
  offset: number; // ms, 오디오 시작과 0박 사이 보정
  bpmChanges: BpmChange[]; // time 오름차순 정렬 보장 (parseChart가 정렬함)
  level: number;
  holdTickIntervalBeats?: number; // 선택. 채보 전체 홀드 틱 간격(비트) 기본값
  // 선택. 박자표 변경 목록(변박 지원). bar 오름차순 정렬 보장(parseChart가 정렬함).
  // 없거나 비어 있으면 전 구간 4/4. 각 항목은 그 마디부터 다음 변경 전까지 적용된다.
  // 마디:틱 -> ms 변환과 마디선 간격에 모두 쓰인다.
  timeSignatures?: TimeSignature[];
  notes: ChartNote[]; // time 오름차순 정렬 보장 (parseChart가 정렬함)
}
