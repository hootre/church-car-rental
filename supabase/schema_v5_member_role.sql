-- V5: 부원(member) 역할 추가
-- admins 테이블의 role 컬럼에 'member' 값 허용
-- (text 타입이면 별도 작업 불필요, enum이면 ALTER 필요)

-- role이 text 타입이면 이 SQL은 실행할 필요 없습니다.
-- 단, check constraint가 있으면 아래처럼 수정해야 합니다:

-- 기존 constraint 제거 (있을 경우)
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_check;

-- 새 constraint 추가 (member 포함)
ALTER TABLE admins ADD CONSTRAINT admins_role_check
  CHECK (role IN ('super_admin', 'manager', 'staff', 'member'));
