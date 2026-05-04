-- ============================================
-- V4: 차량 상세 + 2단계 승인 + 신청서 개편
-- ============================================

-- 1. vehicles 컬럼 추가
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS plate_number text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS year integer;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_company text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_phone text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_expiry text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_agent text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_agent_phone text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS age_limit text DEFAULT '26세';

-- 2. 보험 내역 테이블
CREATE TABLE IF NOT EXISTS vehicle_insurance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  insurance_company text NOT NULL,
  policy_number text,
  start_date date,
  end_date date NOT NULL,
  premium integer DEFAULT 0,
  coverage_type text DEFAULT '종합보험',
  agent_name text,
  agent_phone text,
  accident_phone text,
  memo text,
  created_at timestamptz DEFAULT now()
);

-- 3. 정비 내역 테이블
CREATE TABLE IF NOT EXISTS vehicle_maintenance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  maintenance_date date NOT NULL,
  maintenance_type text NOT NULL DEFAULT '일반정비',
  description text NOT NULL,
  cost integer DEFAULT 0,
  mileage integer,
  shop_name text,
  memo text,
  created_at timestamptz DEFAULT now()
);

-- 4. reservations 신청서 필드 추가
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS destination text;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS passenger_count integer;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS driver_name text;

-- 5. 2단계 승인 필드
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS staff_approved_by uuid REFERENCES admins(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS staff_approved_at timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS manager_approved_by uuid REFERENCES admins(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS manager_approved_at timestamptz;

-- 6. admins 역할 확장 (admin → staff 매핑)
UPDATE admins SET role = 'staff' WHERE role = 'admin';

-- 7. RLS
ALTER TABLE vehicle_insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_insurance_all" ON vehicle_insurance FOR ALL USING (true);
CREATE POLICY "vehicle_maintenance_all" ON vehicle_maintenance FOR ALL USING (true);

-- ============================================
-- 차량 20대 초기 데이터
-- ============================================
DELETE FROM reservation_photos;
DELETE FROM reservations;
DELETE FROM vehicle_insurance;
DELETE FROM vehicle_maintenance;
DELETE FROM vehicles;

INSERT INTO vehicles (name, type, plate_number, year, capacity, description, insurance_company, insurance_phone, insurance_expiry, insurance_agent, insurance_agent_phone, age_limit, available, sort_order) VALUES
('아반떼', 'sedan', '209마9130', 2024, 5, '', '삼성화재', '1588-5114', '01월 09일', '김덕임', '010-9391-0821', '26세', true, 1),
('아반떼', 'sedan', '209마9181', 2024, 5, '', '삼성화재', '1588-5114', '01월 09일', '김덕임', '010-9391-0821', '26세', true, 2),
('45인승 버스', 'bus', '70부5726', 2007, 45, '', 'DB손해보험', '1588-0100', '01월 15일', '우선익', '010-8933-5857', '30세', true, 3),
('스타렉스(wagon)', 'van', '71도5802', 2019, 11, '', '현대해상', '1588-5656', '03월 29일', '우선익', '010-8933-5857', '26세', true, 4),
('제네시스330(원로목사님)', 'sedan', '60누6712', 2012, 5, '원로목사님 전용', 'KB손해보험', '1544-0114', '04월 09일', '우선익', '010-8933-5857', '26세', true, 5),
('카운티(25인승)', 'bus', '77거8599', 2017, 25, '', 'KB손해보험', '1544-0114', '04월 07일', '이현주', '010-4273-2500', '26세', true, 6),
('소나타(사모님)', 'sedan', '24주5295', 2019, 5, '사모님 전용', 'KB손해보험', '1544-0114', '04월 29일', '우선익', '010-8933-5857', '30세', true, 7),
('포터(기도원)', 'truck', '86보7859', 2006, 3, '기도원 전용', '삼성화재', '1588-5114', '05월 16일', '이현주', '010-4273-2500', '26세', true, 8),
('제네시스EQ900(담임목사님)', 'sedan', '37어8255', 2017, 5, '담임목사님 전용', 'KB손해보험', '1544-0114', '06월 25일', '우선익', '010-8933-5857', '26세', true, 9),
('모닝', 'sedan', '15저7382', 2013, 5, '', '현대해상', '1588-5656', '08월 26일', '우선익', '010-8933-5857', '26세', true, 10),
('아반떼', 'sedan', '15저7550', 2013, 5, '', 'KB손해보험', '1544-0114', '08월 31일', '김덕임', '010-9391-0821', '26세', true, 11),
('스타렉스(기도원)', 'van', '70부2204', 2014, 11, '기도원 전용', '삼성화재', '1588-5114', '11월 04일', '김덕임', '010-9391-0821', '26세', true, 12),
('스타렉스', 'van', '70부2205', 2014, 11, '', '삼성화재', '1588-5114', '11월 04일', '김덕임', '010-9391-0821', '전연령', true, 13),
('모닝', 'sedan', '58마3653', 2010, 5, '', '삼성화재', '1588-5114', '11월 11일', '김덕임', '010-9391-0821', '26세', true, 14),
('모닝', 'sedan', '58마3668', 2010, 5, '', '삼성화재', '1588-5114', '11월 11일', '김덕임', '010-9391-0821', '26세', true, 15),
('모닝', 'sedan', '25머0156', 2016, 5, '', 'KB손해보험', '1544-0114', '12월 09일', '이현주', '010-4273-2500', '26세', true, 16),
('스타리아', 'van', '102오3736', 2023, 11, '', '삼성화재', '1588-5114', '12월 11일', '우선익', '010-8933-5857', '26세', true, 17),
('카니발(9인승)', 'van', '25머0195', 2016, 9, '', 'KB손해보험', '1544-0114', '12월 12일', '이현주', '010-4273-2500', '26세', true, 18),
('스타렉스', 'van', '72우1752', 2016, 11, '', '현대해상', '1588-5656', '12월 16일', '이현주', '010-4273-2500', '26세', true, 19),
('스타렉스(가버나움)', 'van', '77더5202', 2016, 11, '가버나움 전용', 'DB손해보험', '1588-0100', '12월 24일', '이현주', '010-4273-2500', '26세', true, 20);

-- 현재 보험 정보를 insurance 테이블에도 삽입
INSERT INTO vehicle_insurance (vehicle_id, insurance_company, end_date, agent_name, agent_phone, accident_phone, coverage_type)
SELECT id, insurance_company, '2026-12-31'::date, insurance_agent, insurance_agent_phone, insurance_phone, '종합보험'
FROM vehicles;
