// 화면에 보이는 한국어 문구를 한곳에 모아둔 테이블.
//
// SPEC.md 10절 "UI 문구 표기 규칙"에 따라 언어와 무관하게 영어로 고정되는 항목
// (판정/클리어 등급, 난이도명, 게이지명, HUD 라벨, RESULT, ON/OFF, 고유명사)은
// 여기 넣지 않는다 — 번역 대상이 아니라 어느 언어에서나 같은 문자열이기 때문이다.
// 그런 값들은 지금처럼 config.ts나 템플릿에 그대로 둔다.
export const KO_STRINGS = {
  common: {
    close: "닫기",
  },

  songSelect: {
    title: "곡 선택",
    start: "시작",
    starting: "실행 중",
    addChart: "+ 채보 추가",
    refreshTitle: "곡 목록 새로고침",
    delete: "삭제",
    importFailed: (message: string) => `채보 임포트 실패: ${message}`,
    mirrorOn: "미러 ON",
    mirrorOff: "미러 OFF",
  },

  options: {
    title: "옵션",
    preset: "프리셋",
    savePreset: "이 프리셋에 저장",
    savedFeedback: "저장됨",
    canvasWidth: "캔버스 폭",
    canvasWidthNarrow: "좁게",
    canvasWidthNormal: "보통",
    canvasWidthWide: "넓게",
    noteSpeed: "노트 속도",
    noteSpeedTooltip:
      "노트가 내려오는 속도를 조절합니다. 50부터 1500까지 설정 가능하고, 숫자가 작을수록 속도가 빠릅니다.",
    audioOffset: "오디오 오프셋(ms)",
    inputOffset: "입력 오프셋(ms)",
    calibration: "오프셋 자동 보정",
    openCalibration: "자동 보정 열기",
    judgeLine: "판정선 위치(px)",
    mouseSensitivity: "마우스 감도(스크래치 임계값 px)",
    keybind: "키 설정",
    openKeybind: "키 설정 열기",
    noteSkin: "노트 스킨",
    gauge: "게이지",
    gasTooltip:
      "Gauge Assist System — 게이지가 0이 되어도 게임을 종료하지 않고 NORMAL게이지로 자동 전환됩니다.",
  },

  // 팔레트 id는 config.ts(NOTE_SKIN_PALETTES)가 갖고, 표시 이름만 여기서 관리한다.
  noteSkin: {
    default: "기본",
    neon: "네온",
    sunset: "선셋",
    forest: "포레스트",
    ice: "아이스",
  },

  keybind: {
    title: "키 설정",
    scratchOnLeft: "스크래치를 왼쪽에",
    awaitingInput: "입력 대기…",
    mouse: "마우스",
    // 순수 로직(core/keymapOptions.ts)은 코드만 반환하고, 문구는 여기서 붙인다.
    errors: {
      laneCannotUseMouse: "레인은 마우스로 설정할 수 없습니다.",
      reservedKey: "다른 기능에 이미 쓰이는 키입니다.",
      duplicateKey: "다른 항목이 이미 쓰는 키입니다.",
    },
  },

  calibration: {
    title: "오프셋 자동 보정",
    introLine1: "스페이스 키로 두 가지 짧은 테스트를 진행합니다.",
    introLine2: "1) 소리 없이 화면만 보고 정확한 타이밍에 입력",
    introLine3: "2) 쿵짝 드럼 소리를 들으며 박자에 맞춰 입력",
    start: "시작",
    countdownGo: "시작!",
    stageVisual: "1/2 시각 테스트 (소리 없음)",
    stageAudio: "2/2 오디오 테스트 (소리 있음)",
    resultInputOffset: "입력 오프셋",
    resultAudioOffset: "오디오 오프셋",
    currentToSuggested: (currentMs: number, suggestedMs: number) => `현재 ${currentMs}ms → 제안 ${suggestedMs}ms`,
    insufficientSamples: (
      visualMatched: number,
      visualTotal: number,
      audioMatched: number,
      audioTotal: number,
    ) =>
      `표본이 부족합니다(시각 ${visualMatched}/${visualTotal}, 오디오 ${audioMatched}/${audioTotal}). 다시 시도해 주세요.`,
    retry: "다시 시도",
    apply: "적용",
    cancel: "취소",
  },

  pause: {
    title: "일시정지",
    resume: "재개",
    restart: "다시시작",
    exit: "나가기",
  },

  results: {
    score: "점수",
    theoreticalMax: "이론치",
    accuracy: "정확도",
    maxCombo: "최대 콤보",
    histogramLabel: "판정 오차 분포",
    timingBarCount: (count: number) => `${count}건`,
    restart: "다시하기",
    songSelect: "곡 선택",
  },
} as const;
