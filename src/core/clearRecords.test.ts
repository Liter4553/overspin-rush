import { describe, expect, it } from "vitest";
import {
  bestGradeForSong,
  clearRecordKey,
  createEmptyClearRecords,
  parseClearRecords,
  serializeClearRecords,
  upsertBestGrade,
  type ClearRecords,
} from "./clearRecords";

describe("upsertBestGrade", () => {
  it("빈 기록에 새 등급을 넣는다", () => {
    const records = upsertBestGrade(createEmptyClearRecords(), "a:normal:normal", "CLEAR");
    expect(records["a:normal:normal"]).toBe("CLEAR");
  });

  it("더 좋은 등급이면 갱신한다", () => {
    let records = upsertBestGrade(createEmptyClearRecords(), "a:normal:normal", "CLEAR");
    records = upsertBestGrade(records, "a:normal:normal", "PERFECT");
    expect(records["a:normal:normal"]).toBe("PERFECT");
  });

  it("더 나쁘거나 같은 등급이면 기존 기록을 유지한다", () => {
    let records = upsertBestGrade(createEmptyClearRecords(), "a:normal:normal", "FULL_COMBO");
    records = upsertBestGrade(records, "a:normal:normal", "CLEAR");
    expect(records["a:normal:normal"]).toBe("FULL_COMBO");

    const same = upsertBestGrade(records, "a:normal:normal", "FULL_COMBO");
    expect(same).toBe(records); // 변화 없으면 참조도 그대로(불필요한 리렌더 방지 확인용)
  });

  it("FAILED로는 기존 CLEAR 이상 기록을 절대 덮어쓰지 않는다", () => {
    let records = upsertBestGrade(createEmptyClearRecords(), "a:normal:normal", "CLEAR");
    records = upsertBestGrade(records, "a:normal:normal", "FAILED");
    expect(records["a:normal:normal"]).toBe("CLEAR");
  });
});

describe("parsePresets / serializeClearRecords 라운드트립", () => {
  it("저장된 값이 없으면 빈 기록이다", () => {
    expect(parseClearRecords(null)).toEqual({});
  });

  it("깨진 JSON이면 빈 기록으로 안전하게 대체한다", () => {
    expect(parseClearRecords("not json")).toEqual({});
  });

  it("배열이면(형식이 다르면) 빈 기록으로 대체한다", () => {
    expect(parseClearRecords(JSON.stringify(["CLEAR"]))).toEqual({});
  });

  it("알 수 없는 등급 문자열이 섞인 항목만 걸러내고 나머지는 유지한다", () => {
    const raw = JSON.stringify({ "a:normal:normal": "CLEAR", "b:hard:hard": "NOT_A_GRADE" });
    expect(parseClearRecords(raw)).toEqual({ "a:normal:normal": "CLEAR" });
  });

  it("직렬화 -> 역직렬화 라운드트립이 원래 값을 그대로 복원한다", () => {
    const records: ClearRecords = { [clearRecordKey("song1", "hard", "hard")]: "HARD_CLEAR" };
    expect(parseClearRecords(serializeClearRecords(records))).toEqual(records);
  });
});

describe("bestGradeForSong", () => {
  const gaugeTypes = ["normal", "hard", "challenge"] as const;

  it("기록이 하나도 없으면 null이다", () => {
    expect(bestGradeForSong(createEmptyClearRecords(), "song1", "normal", gaugeTypes)).toBeNull();
  });

  it("여러 게이지 타입 기록 중 가장 좋은 등급을 고른다", () => {
    let records = createEmptyClearRecords();
    records = upsertBestGrade(records, clearRecordKey("song1", "normal", "normal"), "CLEAR");
    records = upsertBestGrade(records, clearRecordKey("song1", "normal", "hard"), "PERFECT");
    records = upsertBestGrade(records, clearRecordKey("song1", "normal", "challenge"), "FAILED");

    expect(bestGradeForSong(records, "song1", "normal", gaugeTypes)).toBe("PERFECT");
  });

  it("다른 난이도/곡 기록과 섞이지 않는다", () => {
    let records = createEmptyClearRecords();
    records = upsertBestGrade(records, clearRecordKey("song1", "hard", "normal"), "PERFECT");
    expect(bestGradeForSong(records, "song1", "normal", gaugeTypes)).toBeNull();
    expect(bestGradeForSong(records, "song2", "hard", gaugeTypes)).toBeNull();
  });
});
