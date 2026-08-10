/**
 * Motion & haptic constants — minicar-laptime
 * 설계 문서 산출물이다(소스 아님). Phase 3 builder가 실제 구현 시 src/shared/config 등으로 이관한다.
 * 시각 지속시간 값은 tokens.code.css의 --motion-* 커스텀 프로퍼티와 반드시 동기화한다(둘 중 하나만 바꾸지 않는다).
 *
 * 근거: ../tokens-typography-layout-motion.md "모션(통과 피드백 중심)", ../accessibility.md "Reduced Motion".
 */

export const passFeedbackMotion = {
  target: {
    flashInMs: 120,
    flashHoldMs: 60,
    flashOutMs: 220,
  },
  targetBorderline: {
    // 타깃 확정과 동일한 강한 채널 + warning 톤 1회 pulse로 의심 배지 예고
    flashInMs: 120,
    flashHoldMs: 60,
    flashOutMs: 220,
    warningPulseMs: 200,
  },
  otherCar: {
    // 약한 채널 — 위치(모서리 소형)·크기만으로 구분, 지속시간도 짧게
    tickPulseMs: 80,
  },
  bannerCrossfadeMs: 150,
} as const;

/**
 * prefers-reduced-motion: reduce일 때 모든 지속시간을 0으로 치환한다.
 * 색 상태 변화·배지 텍스트는 이 축소와 무관하게 항상 유지한다(컴포넌트 로직 책임).
 */
export function resolveMotion(
  base: typeof passFeedbackMotion,
  reducedMotion: boolean,
): typeof passFeedbackMotion {
  if (!reducedMotion) return base;
  const zeroed = JSON.parse(JSON.stringify(base)) as typeof passFeedbackMotion;
  const zeroOutMs = (obj: Record<string, number>) => {
    for (const key of Object.keys(obj)) obj[key] = 0;
  };
  zeroOutMs(zeroed.target as unknown as Record<string, number>);
  zeroOutMs(zeroed.targetBorderline as unknown as Record<string, number>);
  zeroOutMs(zeroed.otherCar as unknown as Record<string, number>);
  return { ...zeroed, bannerCrossfadeMs: 0 };
}

/**
 * Vibration API 패턴(ms). 타깃 통과에만 사용 — 타차 통과는 햅틱 없음(약한 채널 유지).
 *
 * 플랫폼 제약(접근성 우회 아님): iOS Safari는 Vibration API를 지원하지 않는다.
 * 따라서 시각 피드백(passFeedbackMotion)이 항상 1차 채널이고, 햅틱은 지원 플랫폼(Android 등)의
 * 강화 채널로만 취급한다. 호출부는 `"vibrate" in navigator` 가드 없이 실패해도 무해하도록
 * best-effort로만 호출한다.
 */
export const hapticPatternMs = {
  targetPass: [40],
  targetBorderlinePass: [40],
  otherCarPass: [] as number[],
} as const;
