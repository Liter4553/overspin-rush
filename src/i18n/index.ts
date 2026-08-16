// UI 문구 접근 지점. 지금은 한국어 하나뿐이라 KO_STRINGS를 그대로 내보내지만,
// 언어 설정을 추가할 때 이 파일만 바꿔서 다른 언어 테이블로 교체할 수 있게 분리해둔다.
//
// 주의: 화면 뼈대(main.ts의 app.innerHTML)는 모듈 로드 시 renderAppHtml(t)로 한 번만
// 그려지고, DOM 참조도 그때 querySelector로 잡아둔다. 따라서 실행 중 언어를 바꾸려면
// 뼈대를 다시 그리고 DOM 참조도 다시 잡는 경로가 추가로 필요하다(아직 없음).
import { KO_STRINGS } from "./ko";

export type UiStrings = typeof KO_STRINGS;

export const t: UiStrings = KO_STRINGS;
