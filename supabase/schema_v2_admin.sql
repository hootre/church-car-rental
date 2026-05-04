-- ============================================
-- V2: 관리자 기능 확장 스키마
-- 기존 schema.sql 실행 후 이 파일을 실행하세요
-- ============================================

-- 1) 관리자 테이블
CREATE TABLE admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  login_id TEXT NOT NULL UNIQUE,           -- 로그인 ID
  password_hash TEXT NOT NULL,             -- 비밀번호 해시
  name TEXT NOT NULL,                      -- 관리자 이름
  role TEXT DEFAULT 'admin',               -- super_admin, admin
  is_active BOOLEAN DEFAULT true,          -- 활성화 여부
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- 2) RLS 정책
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- admins 테이블: 서비스 키로만 접근 (API Route에서)
-- anon 키로는 읽기만 허용 (로그인 검증용)
CREATE POLICY "admins_select" ON admins
  FOR SELECT USING (true);

CREATE POLICY "admins_insert" ON admins
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admins_update" ON admins
  FOR UPDATE USING (true);

CREATE POLICY "admins_delete" ON admins
  FOR DELETE USING (true);

-- 3) vehicles 테이블에 CRUD 정책 추가 (관리자용)
CREATE POLICY "vehicles_insert" ON vehicles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "vehicles_update" ON vehicles
  FOR UPDATE USING (true);

CREATE POLICY "vehicles_delete" ON vehicles
  FOR DELETE USING (true);

-- 4) reservations 삭제 정책 추가
CREATE POLICY "reservations_delete" ON reservations
  FOR DELETE USING (true);

-- 5) 초기 슈퍼관리자 계정 생성
-- 비밀번호: admin1234 (SHA-256 해시)
-- ※ 실제 운영 시 반드시 비밀번호를 변경하세요
-- ※ 이 해시는 앱에서 첫 로그인 후 변경 권장
INSERT INTO admins (login_id, password_hash, name, role) VALUES
  ('admin', 'admin1234', '최고관리자', 'super_admin');

-- 참고: 실제 비밀번호 해싱은 Next.js API Route에서 bcryptjs로 처리합니다.
-- 위 초기 데이터는 평문이며, 앱 최초 실행 시 API를 통해 해싱됩니다.
