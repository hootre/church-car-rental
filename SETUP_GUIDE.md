# 교회 차량 대여 예약 시스템 - 설정 가이드

## 1단계: Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 접속 → 회원가입/로그인
2. **New Project** 클릭
3. 프로젝트 이름, 비밀번호, Region(Northeast Asia - ap-northeast-1) 선택
4. 프로젝트 생성 완료까지 약 2분 대기

## 2단계: DB 테이블 생성

1. Supabase 대시보드 → 왼쪽 메뉴 **SQL Editor** 클릭
2. `supabase/schema.sql` 파일 내용을 복사하여 붙여넣기
3. **Run** 클릭
4. 차량 데이터를 교회 실정에 맞게 수정하려면 `vehicles` 테이블의 INSERT문을 수정

## 3단계: API 키 확인

1. Supabase 대시보드 → **Settings** → **API**
2. 아래 두 값을 복사:
   - `Project URL` → NEXT_PUBLIC_SUPABASE_URL
   - `anon public` 키 → NEXT_PUBLIC_SUPABASE_ANON_KEY

## 4단계: 로컬 개발 환경 설정

```bash
# 프로젝트 폴더로 이동
cd church-car-rental

# .env.local 파일 생성
cp .env.local.example .env.local

# .env.local 파일을 편집하여 Supabase 키 입력
# NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
# ADMIN_PASSWORD=원하는비밀번호
# NEXT_PUBLIC_CHURCH_NAME=OO교회

# 패키지 설치
npm install

# 개발 서버 시작
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 5단계: Vercel 배포

1. GitHub에 코드 푸시
```bash
git init
git add .
git commit -m "초기 커밋: 교회 차량 대여 시스템"
git remote add origin https://github.com/your-username/church-car-rental.git
git push -u origin main
```

2. [vercel.com](https://vercel.com) 접속 → GitHub로 로그인
3. **Import Project** → GitHub 저장소 선택
4. **Environment Variables**에 다음 추가:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ADMIN_PASSWORD`
   - `NEXT_PUBLIC_CHURCH_NAME`
5. **Deploy** 클릭

배포 완료 후 `https://your-project.vercel.app` 에서 접속 가능

## 페이지 구성

| 경로 | 설명 |
|------|------|
| `/` | 홈 (메뉴 선택) |
| `/reserve` | 예약 신청 (차량선택 → 정보입력 → 확인) |
| `/check` | 예약 조회 (이름+전화번호) |
| `/admin` | 관리자 (비밀번호 로그인 → 승인/거절) |

## 커스터마이징

### 차량 추가/수정
Supabase 대시보드 → Table Editor → `vehicles` 테이블에서 직접 추가/수정

### 관리자 비밀번호 변경
Vercel 대시보드 → Settings → Environment Variables → `ADMIN_PASSWORD` 수정 후 재배포

### 교회 이름 변경
환경변수 `NEXT_PUBLIC_CHURCH_NAME` 수정
