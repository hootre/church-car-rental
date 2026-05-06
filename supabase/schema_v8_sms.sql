-- ============================================
-- V8: SMS 알림 시스템
-- ============================================

-- 1. admins 테이블에 phone 컬럼 추가 (SMS 수신용)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. SMS 설정 테이블 (무료/유료 모드, 일일 발송량 추적)
CREATE TABLE IF NOT EXISTS sms_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  mode TEXT NOT NULL DEFAULT 'free' CHECK (mode IN ('free', 'paid')),
  daily_limit INTEGER NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES admins(id)
);

-- 기본 설정 삽입
INSERT INTO sms_settings (id, mode, daily_limit) VALUES ('default', 'free', 50)
ON CONFLICT (id) DO NOTHING;

-- 3. SMS 발송 로그 (일일 카운트용)
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at ON sms_logs(sent_at DESC);

-- RLS
ALTER TABLE sms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for sms_settings" ON sms_settings FOR ALL USING (true);
CREATE POLICY "Allow all for sms_logs" ON sms_logs FOR ALL USING (true);
