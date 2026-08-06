// 음원 없이도 렌더링/타이밍을 검증하기 위한 더미 채보 (SPEC.md 7절).
// parseChart를 거쳐 실제 게임이 채보 파일을 읽는 경로와 동일하게 검증된다.
export const dummyChartRaw = {
  version: 1,
  title: "더미 채보",
  artist: "Overspin RUSH",
  audio: "",
  offset: 0,
  bpmChanges: [{ time: 0, bpm: 150 }],
  level: 1,
  notes: [
    { time: 800, lane: 0, type: "tap" },
    { time: 1200, lane: 1, type: "tap" },
    { time: 1600, lane: 2, type: "tap" },
    { time: 2000, lane: "fx", type: "tap" },
    { time: 2400, lane: 0, type: "tap" },
    { time: 2800, lane: 1, type: "hold", duration: 800 },
    { time: 3200, lane: 2, type: "tap" },
    { time: 4000, lane: "fx", type: "hold", duration: 800 },
    { time: 4400, lane: "scratch", type: "tap" },
    { time: 4800, lane: 0, type: "tap" },
    { time: 5200, lane: 1, type: "tap" },
    { time: 5600, lane: 2, type: "tap" },
    { time: 6000, lane: "scratch", type: "tap" },
    { time: 6400, lane: "fx", type: "tap" },
  ],
};
