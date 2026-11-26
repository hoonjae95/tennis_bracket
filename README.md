# L.P.T 대진표

테니스 동호회 **L.P.T (Let's Play Tennis)** 의 정기 모임·대회 대진표를 자동으로 만들어 주는 웹 서비스입니다.
모임마다 참가자 등급·성별·코트 수를 고려해 대진표를 손으로 짜던 작업을, 관리자가 몇 번의 클릭으로 끝낼 수 있게 만들었습니다.

- 배포: https://tennis-bracket-bay.vercel.app

## 주요 기능

### 일정(방) 만들기
- 단계형 위저드: 일정 → 경기 규칙 → 요약 확인 → 참가자 선택
- 요일별 정기 모임 템플릿(화/목/토)과 커스텀 일정 지원
- 코트 유형(인조잔디/하드/클레이), 경기 시간, 휴식·몸풀기 시간, 대회 마무리 시간 설정
- 경기 종류 선택: 남자/여자 복식, 혼합 복식, 잡복식(성별 무관), 남자/여자 단식
- 정회원 외에 그날만 참여하는 게스트 등록

### 대진표 자동 생성 (`src/lib/bracket/generate.ts`)
순수 함수로 구현해 브라우저에서 바로 실행되므로, 저장하기 전에 여러 번 다시 뽑아 볼 수 있습니다.
- **팀 밸런스**: 등급 점수(A=3, B=2, C=1, D=0)의 팀 합 차이가 2 이하가 되도록 편성
- **연속 출전 제한**: 3라운드 연속 출전·연속 휴식을 피함. 인원이 부족해 어쩔 수 없이 연속 출전하게 되면 실제 연속 횟수를 비고에 표시
- **경기 수 균등화**: 일반 모드는 1인당 경기 수 차이를 최대 1까지 허용, 대회 모드는 성별 그룹별 경기 수를 같게 맞춤
- **대회 모드**: 라운드×코트별 경기 종류를 미리 계획하고, 1인당 최대 경기 수 제한 지원
- **빈 슬롯 처리**: 성별 제한 경기를 만들 수 없으면 잡복식으로 대체하고, 인원이 모자라면 라운드마다 돌아가며 한 코트를 "자유 랠리 연습"으로 지정
- **수동 편성 모드**: 빈 틀에서 시작해 코트·라운드별 경기 종류와 선수를 직접 지정(조건을 어기면 경고 표시)

### 조회 화면
- 누구나 로그인 없이 일정별 대진표와 라운드별 휴식 선수 확인 가능
- 모바일 화면에서도 경기 한 줄이 줄바꿈되지 않도록 축약 표기 사용

### 관리자
- 정회원 관리(등급·성별), 일정별 등급 덮어쓰기, 일정 종료·삭제

## 기술 스택

| 구분 | 사용 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| 스타일 | Tailwind CSS v4 |
| DB | Supabase (PostgreSQL, RLS) |
| 인증 | 단일 관리자 계정 + `jose` 기반 JWT 세션 쿠키 |
| 배포 | Vercel |

## 아키텍처

- **인증**: Supabase Auth를 쓰지 않고, 환경변수로 정한 관리자 계정 1개로 로그인하면 서명된 JWT를 HttpOnly 쿠키에 담습니다(`src/lib/auth/session.ts`). `src/proxy.ts`(Next.js 16의 middleware)가 `/admin/*`, `/api/admin/*` 접근을 막습니다.
- **데이터 접근**
  - 읽기: anon key 클라이언트를 씁니다. RLS로 모든 테이블에 공개 `select`만 허용합니다.
  - 쓰기: 관리자 세션을 확인한 Server Action에서만 service-role 클라이언트(`src/lib/supabase/admin.ts`)로 실행합니다. RLS에는 공개 쓰기 정책이 없습니다.
- **스키마**: `rooms`(일정) → `courts`, `room_participants`(정회원 또는 게스트, 일정별 등급) / `matches` → `match_players`(팀 1·2). 마이그레이션은 `supabase/migrations/`에 있습니다.
- **저장 범위**: DB에는 경기와 선수 배정만 저장합니다. 휴식 선수·자유 랠리 연습·비고는 화면을 그릴 때 저장된 경기로부터 다시 계산합니다.

```
src/
├── app/                 # 라우트 (App Router)
│   ├── page.tsx         # 일정 목록
│   ├── rooms/[id]/      # 공개 대진표 조회
│   └── admin/           # 로그인, 정회원 관리, 일정 생성·수정, 대진표 편성
├── components/          # bracket / rooms / members UI
├── lib/
│   ├── bracket/         # 대진표 생성 알고리즘, 타입, 저장 Server Action
│   ├── rooms/           # 일정 템플릿, 경기 수 계산, Server Action
│   ├── members/         # 정회원 Server Action
│   ├── auth/            # JWT 세션
│   └── supabase/        # anon / server / service-role 클라이언트, DB 타입
└── proxy.ts             # 관리자 경로 보호
supabase/migrations/     # DB 스키마 마이그레이션
```

## 로컬 실행

```bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev                  # http://localhost:3000
```

| 환경변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 프로젝트 URL, anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 쓰기용 키 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 관리자 계정 |
| `SESSION_SECRET` | 세션 JWT 서명키 |

DB 스키마는 `npx supabase db push`로 적용합니다. 시드 데이터(`0002_seed_members.sql`)의 회원 이름은 공개용 가명입니다.
