// 콘텐츠 자연 크기와 사용 가능한 뷰포트 크기로부터 맞춤 배율을 계산하는 순수 함수.
// 세로/가로 중 더 빡빡한 쪽에 맞추고, 상하한을 벗어나지 않게 자른다.
export function computeFitScale(
  naturalWidth: number,
  naturalHeight: number,
  availableWidth: number,
  availableHeight: number,
  minScale: number,
  maxScale: number,
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0) return 1;

  const heightScale = availableHeight / naturalHeight;
  const widthScale = availableWidth / naturalWidth;
  const scale = Math.min(heightScale, widthScale);

  return Math.min(maxScale, Math.max(minScale, scale));
}
