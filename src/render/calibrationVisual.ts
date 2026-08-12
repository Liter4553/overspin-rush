// 오프셋 자동 보정 마법사(SPEC.md 6절)의 시각 테스트 전용 인디케이터.
// 실제 게임플레이 캔버스/레인 레이아웃과 완전히 독립적인 별도의 작은 캔버스에 그린다.

// 다음 박까지 남은 시간을 0(박 시점)~1(리드인 시작)로 정규화한다. 리드인 구간
// 밖(더 이르거나 이미 지난)은 각각 1/0으로 clamp한다.
export function calibrationIndicatorProgress(nowMs: number, nextBeatTimeMs: number, leadMs: number): number {
  if (leadMs <= 0) return 0;
  const remaining = nextBeatTimeMs - nowMs;
  return Math.min(1, Math.max(0, remaining / leadMs));
}

// 가장 가까운 박과의 거리가 flashWindowMs 이내면 true — 박 시점을 짧게 반짝여 보여준다.
export function isCalibrationBeatFlash(nowMs: number, nearestBeatTimeMs: number, flashWindowMs: number): boolean {
  return Math.abs(nowMs - nearestBeatTimeMs) <= flashWindowMs;
}

// 목표 링(항상 표시) + 박을 향해 줄어드는 다가오는 원. progress가 0에 가까울수록
// 다가오는 원이 목표 링에 근접한다. flash가 true면 박 시점이라 목표 링이 강조된다.
export function drawCalibrationBeatIndicator(
  ctx: CanvasRenderingContext2D,
  size: number,
  progress: number,
  flash: boolean,
): void {
  const cx = size / 2;
  const cy = size / 2;
  const targetRadius = size * 0.18;
  const outerRadius = targetRadius + (size * 0.45 - targetRadius) * progress;

  ctx.clearRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(cx, cy, targetRadius, 0, Math.PI * 2);
  ctx.strokeStyle = flash ? "#FAC775" : "#4fc3f7";
  ctx.lineWidth = flash ? 6 : 3;
  ctx.stroke();

  if (progress > 0.02) {
    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(232, 234, 240, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
