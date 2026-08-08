import { describe, expect, it } from "vitest";
import {
  createEmptyHighScores,
  highScoreKey,
  parseHighScores,
  serializeHighScores,
  upsertHighScore,
} from "./highScores";

describe("upsertHighScore", () => {
  it("빈 기록에 점수를 넣는다", () => {
    const scores = upsertHighScore(createEmptyHighScores(), "a:normal", 100);
    expect(scores["a:normal"]).toBe(100);
  });

  it("더 높은 점수면 갱신한다", () => {
    let scores = upsertHighScore(createEmptyHighScores(), "a:normal", 100);
    scores = upsertHighScore(scores, "a:normal", 200);
    expect(scores["a:normal"]).toBe(200);
  });

  it("더 낮거나 같은 점수면 기존 기록을 유지하고 참조도 바뀌지 않는다", () => {
    const scores = upsertHighScore(createEmptyHighScores(), "a:normal", 100);
    const same = upsertHighScore(scores, "a:normal", 100);
    const lower = upsertHighScore(scores, "a:normal", 50);
    expect(same).toBe(scores);
    expect(lower).toBe(scores);
  });
});

describe("parseHighScores / serializeHighScores", () => {
  it("저장된 값이 없으면 빈 기록이다", () => {
    expect(parseHighScores(null)).toEqual({});
  });

  it("깨진 JSON이면 빈 기록으로 안전하게 대체한다", () => {
    expect(parseHighScores("not json")).toEqual({});
  });

  it("배열이면 빈 기록으로 대체한다", () => {
    expect(parseHighScores(JSON.stringify([1, 2]))).toEqual({});
  });

  it("숫자가 아닌 값이 섞인 항목만 걸러내고 나머지는 유지한다", () => {
    const raw = JSON.stringify({ "a:normal": 100, "b:hard": "not-a-number" });
    expect(parseHighScores(raw)).toEqual({ "a:normal": 100 });
  });

  it("직렬화 -> 역직렬화 라운드트립이 원래 값을 그대로 복원한다", () => {
    const scores = { [highScoreKey("song1", "hard")]: 999 };
    expect(parseHighScores(serializeHighScores(scores))).toEqual(scores);
  });
});
