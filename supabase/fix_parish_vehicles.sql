-- ============================================
-- 교구전용차량(parish) 카테고리 도입 (1회성)
--
-- vehicles.category 컬럼은 v6에서 이미 'shared' / 'personal' 두 값으로 만들어졌습니다.
-- 이번 변경으로 'parish' 가 추가되었습니다.
--   - shared   : 누구나 예약 가능 (공유차량)
--   - personal : 별도관리차량 (예: 담임/사모님 전용)
--   - parish   : 교구전용차량 (예: 아반떼·모닝 — 교구별 운용)
--
-- 코드(타입)에서는 union 으로 정의되어 있으므로 DB 컬럼은 text 그대로면 OK.
-- check 제약이 있다면 'parish' 를 허용하도록 갱신하세요.
-- ============================================

-- (선택) 기존 check 제약 갱신 — 없으면 무시
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_category_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_category_check
  CHECK (category IN ('shared', 'personal', 'parish'));

-- ============================================
-- 아반떼 / 모닝 차량들을 parish 로 변경
-- (차량명 기준 — 필요 시 plate_number 로 더 정확하게 좁힐 수 있음)
-- ============================================
UPDATE vehicles
SET category = 'parish'
WHERE
  name LIKE '%아반떼%'
  OR name LIKE '%모닝%';

-- ============================================
-- 결과 확인 (선택)
-- ============================================
-- SELECT id, name, plate_number, category
-- FROM vehicles
-- ORDER BY category, sort_order;
