-- 관리자 활동 로그 테이블
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  admin_name TEXT NOT NULL,
  action TEXT NOT NULL,           -- 'admin_add', 'admin_delete', 'reservation_delete', 'reservation_status_change', 'vehicle_add', 'vehicle_delete', 'sms_settings_change' 등
  target_type TEXT,               -- 'admin', 'reservation', 'vehicle', 'settings'
  target_id TEXT,                 -- 대상 ID
  details JSONB DEFAULT '{}',    -- 상세 정보 (변경 전/후 값 등)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
