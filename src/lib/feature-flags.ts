/**
 * Feature Flags
 *
 * 운영 시 토글이 필요한 기능을 한 곳에서 관리합니다.
 * 추후 SMS 사용을 시작하려면 SMS_ENABLED 값만 true로 바꾸면 됩니다.
 */

export const FEATURE_FLAGS = {
  // 문자 알림 발송 + 관리자 화면의 SMS 설정 탭 노출 여부
  SMS_ENABLED: false,
} as const;
