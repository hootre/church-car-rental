-- v7: 긴급승인자(emergency) 역할 추가
-- 기존 role CHECK 제약 조건 삭제 후 재생성
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE admins ADD CONSTRAINT admins_role_check
  CHECK (role IN ('super_admin', 'manager', 'staff', 'member', 'emergency'));
