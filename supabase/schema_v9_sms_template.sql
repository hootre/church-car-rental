-- ============================================
-- V9: SMS 메시지 템플릿 커스터마이징
-- ============================================

ALTER TABLE sms_settings ADD COLUMN IF NOT EXISTS message_template TEXT DEFAULT '[차량부] 예약 승인 완료\n차량: {vehicle}\n기간: {start}~{end}\n안전 운행하세요!';

-- 기존 row 업데이트
UPDATE sms_settings
SET message_template = '[차량부] 예약 승인 완료\n차량: {vehicle}\n기간: {start}~{end}\n안전 운행하세요!'
WHERE id = 'default' AND message_template IS NULL;
