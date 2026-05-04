-- ============================================
-- V3: 상태 확장 + 사진 업로드 스키마
-- schema.sql, schema_v2_admin.sql 실행 후 이 파일을 실행하세요
-- ============================================

-- 상태 값 설명:
--   pending    = 대기중 (예약 신청됨)
--   approved   = 승인 (관리자 승인)
--   rejected   = 거절 (관리자 거절)
--   in_use     = 대여중 (차량 인수됨, 사진 첨부)
--   returned   = 반납완료 (차량 반납됨, 사진 첨부)

-- 1) 예약 사진 테이블
CREATE TABLE reservation_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL,              -- pickup (대여시), return (반납시)
  photo_url TEXT NOT NULL,               -- Supabase Storage URL
  memo TEXT,                             -- 사진 메모 (상태 설명 등)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_photos_reservation ON reservation_photos(reservation_id);

-- 2) RLS 정책
ALTER TABLE reservation_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_select" ON reservation_photos
  FOR SELECT USING (true);

CREATE POLICY "photos_insert" ON reservation_photos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "photos_delete" ON reservation_photos
  FOR DELETE USING (true);

-- 3) reservations 테이블에 대여/반납 시간 기록 컬럼 추가
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

-- ============================================
-- Supabase Storage 설정 (대시보드에서 수동 설정)
-- ============================================
-- 1. Supabase 대시보드 → Storage → New bucket
-- 2. Bucket name: "vehicle-photos"
-- 3. Public bucket: ON (체크)
-- 4. File size limit: 5MB
-- 5. Allowed MIME types: image/jpeg, image/png, image/webp
--
-- 또는 아래 SQL로 생성:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS 정책 (누구나 업로드/조회 가능)
CREATE POLICY "vehicle_photos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'vehicle-photos');

CREATE POLICY "vehicle_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'vehicle-photos');

CREATE POLICY "vehicle_photos_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'vehicle-photos');
