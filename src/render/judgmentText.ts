import type { JudgeGrade, TimingSign } from "../core/judge";
import { JUDGE_GRADE_COLORS, JUDGE_TEXT_DISPLAY_MS } from "../config";
import type { LaneLayout } from "./canvas";

export interface LatestJudgment {
  grade: JudgeGrade;
  sign: TimingSign;
  shownAtMs: number; // 표시 시작 시점의 게임 시간(ms)
}

const GRADE_LABEL: Record<JudgeGrade, string> = {
  PERFECT_PLUS: "PERFECT+",
  PERFECT: "PERFECT",
  GREAT: "GREAT",
  GOOD: "GOOD",
  MISS: "MISS",
};

// 최근 판정을 판정선 위에 잠깐 표시한다. 애니메이션은 마일스톤 9에서.
export function drawJudgmentText(
  ctx: CanvasRenderingContext2D,
  layout: LaneLayout,
  latest: LatestJudgment | null,
  currentGameTimeMs: number,
): void {
  if (latest === null) return;
  if (currentGameTimeMs - latest.shownAtMs > JUDGE_TEXT_DISPLAY_MS) return;

  const cx = layout.canvasWidth / 2;
  const y = layout.judgeLineY - 60;

  ctx.textAlign = "center";
  ctx.fillStyle = JUDGE_GRADE_COLORS[latest.grade];
  ctx.font = "bold 26px sans-serif";
  ctx.fillText(GRADE_LABEL[latest.grade], cx, y);

  if (latest.sign !== null) {
    ctx.fillStyle = "#8b93a7";
    ctx.font = "14px sans-serif";
    ctx.fillText(latest.sign, cx, y + 20);
  }
  ctx.textAlign = "left";
}

// 콤보를 판정 텍스트보다 충분히 위에 상시 표시한다(깜빡이지 않음). 상단 HUD를 따로
// 보지 않아도 판정이 뜨는 자리만 보면 콤보까지 같이 확인되게 하기 위함.
export function drawComboDisplay(ctx: CanvasRenderingContext2D, layout: LaneLayout, combo: number): void {
  if (combo <= 0) return;

  const cx = layout.canvasWidth / 2;
  const y = layout.judgeLineY - 130;

  ctx.textAlign = "center";
  ctx.fillStyle = "#F2E9D8";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText(String(combo), cx, y);
  ctx.fillStyle = "#8b93a7";
  ctx.font = "13px sans-serif";
  ctx.fillText("COMBO", cx, y + 20);
  ctx.textAlign = "left";
}
