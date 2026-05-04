-- ============================================
-- 교회 주차부 차량 대여 예약 시스템 DB 스키마
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1) 차량 테이블
CREATE TABLE vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                    -- 차량명 (예: '25인승 버스')
  type TEXT NOT NULL,                    -- 유형: bus, van, sedan, suv
  plate_number TEXT NOT NULL UNIQUE,     -- 차량번호
  capacity INT NOT NULL DEFAULT 5,      -- 탑승 인원
  description TEXT,                      -- 설명/비고
  available BOOLEAN DEFAULT true,        -- 대여 가능 여부
  sort_order INT DEFAULT 0,             -- 정렬 순서
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2) 예약 테이블
CREATE TABLE reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  guest_name TEXT NOT NULL,              -- 예약자 이름
  phone TEXT NOT NULL,                   -- 전화번호
  department TEXT NOT NULL,              -- 소속 부서
  purpose TEXT,                          -- 사용 목적
  start_date DATE NOT NULL,             -- 대여 시작일
  start_time TIME NOT NULL,             -- 대여 시작 시간
  end_date DATE NOT NULL,               -- 반납일
  end_time TIME NOT NULL,               -- 반납 시간
  status TEXT DEFAULT 'pending',         -- pending, approved, rejected
  admin_note TEXT,                       -- 관리자 메모
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3) 인덱스
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_dates ON reservations(start_date, end_date);
CREATE INDEX idx_reservations_phone ON reservations(phone);

-- 4) updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 5) RLS (Row Level Security) 정책
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- 누구나 차량 목록 조회 가능
CREATE POLICY "vehicles_select" ON vehicles
  FOR SELECT USING (true);

-- 누구나 예약 생성 가능 (비회원)
CREATE POLICY "reservations_insert" ON reservations
  FOR INSERT WITH CHECK (true);

-- 누구나 예약 조회 가능 (본인 확인은 앱 레벨에서)
CREATE POLICY "reservations_select" ON reservations
  FOR SELECT USING (true);

-- 예약 업데이트는 서비스 키로만 (관리자 API에서)
CREATE POLICY "reservations_update" ON reservations
  FOR UPDATE USING (true);

-- ============================================
-- 초기 차량 데이터 (교회 실정에 맞게 수정하세요)
-- ============================================
INSERT INTO vehicles (name, type, plate_number, capacity, description, sort_order) VALUES
  ('45인승 대형버스', 'bus', '서울 00가 0001', 45, '수련회/단체행사용', 1),
  ('25인승 중형버스', 'bus', '서울 00가 0002', 25, '부서 단체이동용', 2),
  ('스타렉스 1호', 'van', '서울 00가 0003', 11, '소그룹 이동용', 3),
  ('스타렉스 2호', 'van', '서울 00가 0004', 11, '소그룹 이동용', 4),
  ('스타렉스 3호', 'van', '서울 00가 0005', 11, '소그룹 이동용', 5),
  ('카니발 1호', 'van', '서울 00가 0006', 9, '중형 그룹용', 6),
  ('카니발 2호', 'van', '서울 00가 0007', 9, '중형 그룹용', 7),
  ('쏘나타', 'sedan', '서울 00가 0008', 5, '소수 인원/업무용', 8),
  ('아반떼', 'sedan', '서울 00가 0009', 5, '소수 인원/업무용', 9),
  ('싼타페', 'suv', '서울 00가 0010', 5, 'SUV/다목적용', 10),
  ('투싼', 'suv', '서울 00가 0011', 5, 'SUV/다목적용', 11),
  ('포터 화물차', 'truck', '서울 00가 0012', 3, '짐 운반/이사용', 12);
