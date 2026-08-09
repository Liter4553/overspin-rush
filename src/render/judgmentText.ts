import type { JudgeGrade, TimingSign } from "../core/judge";
import { JUDGE_GRADE_COLORS, JUDGE_TEXT_DISPLAY_MS, JUDGE_TEXT_FADE_MS, JUDGE_TEXT_POP_MS } from "../config";
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

export interface JudgmentTextAnimation {
  scale: number;
  alpha: number;
}

// age(경과 시간, ms)에 따른 스케일/알파. 등장 시 살짝 크게 튀어나왔다가(팝인) 원래
// 크기로 줄어들고, 끝나기 전 fadeMs 구간 동안 페이드아웃한다. 표시 구간을 벗어나면 null.
export function computeJudgmentTextAnimation(
  age: number,
  displayMs: number = JUDGE_TEXT_DISPLAY_MS,
  popMs: number = JUDGE_TEXT_POP_MS,
  fadeMs: number = JUDGE_TEXT_FADE_MS,
): JudgmentTextAnimation | null {
  if (age < 0 || age > displayMs) return null;

  let scale = 1;
  if (age < popMs) {
    const t = age / popMs;
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    scale = 1.4 + (1 - 1.4) * eased; // 1.4배로 시작해 1.0배로 줄어든다
  }

  let alpha = 1;
  const fadeStart = displayMs - fadeMs;
  if (age > fadeStart) {
    alpha = Math.max(0, 1 - (age - fadeStart) / fadeMs);
  }

  return { scale, alpha };
}

// 최근 판정을 판정선 위에 잠깐 표시한다.
export function drawJudgmentText(
  ctx: CanvasRenderingContext2D,
  layout: LaneLayout,
  latest: LatestJudgment | null,
  currentGameTimeMs: number,
): void {
  if (latest === null) return;
  const animation = computeJudgmentTextAnimation(currentGameTimeMs - latest.shownAtMs);
  if (animation === null) return;

  const cx = layout.canvasWidth / 2;
  const y = layout.judgeLineY - 60;

  ctx.save();
  ctx.globalAlpha = animation.alpha;
  ctx.translate(cx, y);
  ctx.scale(animation.scale, animation.scale);
  ctx.translate(-cx, -y);

  ctx.textAlign = "center";
  ctx.fillStyle = JUDGE_GRADE_COLORS[latest.grade];
  ctx.font = "bold 26px sans-serif";
  ctx.fillText(GRADE_LABEL[latest.grade], cx, y);

  if (latest.sign !== null) {
    ctx.fillStyle = "#8b93a7";
    ctx.font = "14px sans-serif";
    ctx.fillText(latest.sign, cx, y + 20);
  }
  ctx.restore();
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
