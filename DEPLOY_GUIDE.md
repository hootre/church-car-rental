# 한국중앙교회 차량대여 시스템 - 배포 가이드

## 1. Supabase 설정 확인

### 1-1. SQL 마이그레이션 실행 (순서대로)
Supabase Dashboard → SQL Editor에서 아래 파일들을 순서대로 실행하세요.
이미 실행한 것은 건너뛰어도 됩니다.

```
supabase/schema.sql          ← 기본 테이블 (vehicles, reservations)
supabase/schema_v2_admin.sql ← 관리자 테이블 + 초기 계정
supabase/schema_v3_photos.sql ← 사진 테이블
supabase/schema_v4_upgrade.sql ← 컬럼 추가 (destination, passenger_count 등)
supabase/schema_v5_member_role.sql ← 부원(member) 역할 추가
supabase/schema_v6_vehicle_category.sql ← 차량 분류(shared/personal) 추가
```

### 1-2. Storage 버킷 생성
Supabase Dashboard → Storage에서:
1. **New bucket** 클릭
2. 이름: `vehicle-photos`
3. **Public bucket** 체크 (공개)
4. 생성 완료

### 1-3. Storage RLS 정책 설정
Storage → vehicle-photos → Policies에서 아래 정책 추가:

**업로드 허용 (INSERT)**
```sql
CREATE POLICY "Allow public upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'vehicle-photos');
```

**조회 허용 (SELECT)**
```sql
CREATE POLICY "Allow public read" ON storage.objects
FOR SELECT USING (bucket_id = 'vehicle-photos');
```

**삭제 허용 (DELETE)**
```sql
CREATE POLICY "Allow public delete" ON storage.objects
FOR DELETE USING (bucket_id = 'vehicle-photos');
```

### 1-4. 테이블 RLS 정책
Supabase Dashboard → Authentication → Policies에서 각 테이블에 대해:

**vehicles, reservations, reservation_photos, admins** 테이블 모두:
```sql
-- 조회 허용
CREATE POLICY "Allow public read" ON [테이블명]
FOR SELECT USING (true);

-- 삽입 허용
CREATE POLICY "Allow public insert" ON [테이블명]
FOR INSERT WITH CHECK (true);

-- 수정 허용
CREATE POLICY "Allow public update" ON [테이블명]
FOR UPDATE USING (true);

-- 삭제 허용
CREATE POLICY "Allow public delete" ON [테이블명]
FOR DELETE USING (true);
```

> 참고: 현재는 anon key로 직접 접근하는 구조이므로 모든 작업을 허용합니다.
> 추후 보안 강화 시 서버사이드 인증으로 전환하는 것을 권장합니다.

---

## 2. Vercel 배포

### 2-1. GitHub에 코드 올리기
```bash
cd church-car-rental-main
git init
git add .
git commit -m "Initial commit: 한국중앙교회 차량대여 시스템"
git branch -M main
git remote add origin https://github.com/[계정명]/church-car-rental.git
git push -u origin main
```

### 2-2. Vercel 프로젝트 생성
1. [vercel.com](https://vercel.com) 로그인
2. **Add New Project** → GitHub 저장소 연결
3. Framework: **Next.js** (자동 감지됨)
4. Root Directory: `.` (기본값)

### 2-3. 환경변수 설정 (필수!)
Vercel 프로젝트 → Settings → Environment Variables에서:

| 변수명 | 값 |
|--------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public 키 |

> .env.local 파일은 git에 올라가지 않으므로 Vercel에 직접 입력해야 합니다.

### 2-4. 배포
**Deploy** 클릭하면 자동 빌드 및 배포됩니다.

---

## 3. 배포 후 확인사항

- [ ] 메인 페이지 접속 확인
- [ ] 차량 목록 로딩 확인
- [ ] 예약 신청 → 조회 플로우 테스트
- [ ] 관리자 로그인 (기본 계정: admin / admin1234)
- [ ] 예약 승인 플로우 (담당→부장) 테스트
- [ ] 사진 업로드/조회 테스트
- [ ] 문서 출력(A4) 테스트

---

## 4. 커스텀 도메인 연결 (선택)

Vercel → Settings → Domains에서:
1. 도메인 입력 (예: car.church.kr)
2. DNS 설정에서 CNAME을 `cname.vercel-dns.com`으로 지정
3. SSL 자동 적용

---

## 5. 기본 관리자 계정

| 아이디 | 비밀번호 | 역할 |
|--------|----------|------|
| admin | admin1234 | 최고관리자 |

> 배포 후 반드시 비밀번호를 변경하세요!

---

## 기술 스택
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + Storage)
- Vercel (호스팅)
