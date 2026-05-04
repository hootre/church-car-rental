-- V6: 차량 분류(category) 컬럼 추가
-- shared = 공유차량 (기본값), personal = 개인차량

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS category text DEFAULT 'shared';

-- 기존 차량은 모두 공유차량으로 설정
UPDATE vehicles SET category = 'shared' WHERE category IS NULL;
