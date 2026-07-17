# JK External API

한국에서 생활·지역 프로젝트를 만들 때 필요한 외부 정보원, 데이터 종류, 기술, [NomaDamas/k-skill](https://github.com/NomaDamas/k-skill), 프로젝트 청사진을 연결하는 읽기 전용 공개 색인입니다.

운영 주소: <https://rafaam11.github.io/jk-external-api/>

## 무엇이 들어 있나

- 공식 정보원 그룹 14개와 확인일·귀속·이용조건·개발 문서 링크
- upstream 테스트 fixture를 제외한 k-skill `SKILL.md` 전체 스냅샷(활성 + legacy 기록)
- 출퇴근, 동네 인프라, 안전·환경, 지역 문화, 이동약자, 가족 주말의 청사진 6개
- 명시 좌표 기반 Atlas, 통합 검색과 복합 필터, 최대 4개 비교
- 날씨·대기·대중교통·공공시설·장소·공연의 선택적 읽기 전용 Worker 미리보기

원문 데이터는 저장소에 복제하지 않습니다. 이 저장소는 요약 메타데이터, 귀속, 공식 링크, 확인일과 생성된 k-skill frontmatter 스냅샷만 보관합니다.

## 구조

```text
apps/site            Astro + Preact GitHub Pages 정적 사이트
apps/preview-worker  Hono Cloudflare Worker, allow-list 미리보기 6개
packages/catalog     Zod 공통 계약, 큐레이션 데이터, k-skill 동기화
```

데이터는 `packages/catalog`에서 검증된 뒤 사이트와 Worker가 같은 ID·응답 계약을 사용합니다. 데이터베이스, 로그인, 쓰기 API, 사용자 위치 권한, 사용자 추적, 쿠키 저장은 없습니다.

## 로컬 개발

Node.js 24와 pnpm 10이 필요합니다.

```bash
corepack enable
pnpm install
pnpm --filter @jk-external-api/site dev
pnpm --filter @jk-external-api/preview-worker dev
```

Worker 미리보기에는 `apps/preview-worker/.dev.vars.example`을 `.dev.vars`로 복사하고 실제 키를 입력합니다. 비밀키는 사이트의 `PUBLIC_*` 변수나 브라우저 번들에 넣지 않습니다.

```text
DATA_GO_KR_API_KEY
KAKAO_REST_API_KEY
KOPIS_SERVICE_KEY
```

사이트가 Worker를 사용하려면 빌드 시 `PUBLIC_PREVIEW_API_BASE_URL`만 지정합니다. 값이 없거나 Worker가 실패해도 정적 상세 기록과 공식 원문 링크는 계속 동작합니다.

## 검증

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm links
pnpm exec playwright install chromium
pnpm e2e
```

카탈로그 테스트는 필수 필드, ID 중복, 끊어진 관계, URL·날짜·Atlas 좌표, 오래된 확인일을 검사합니다. Worker 테스트는 6개 어댑터, 빈 결과, timeout, 429·5xx, 형식 변경, cache, CORS, rate limit과 비밀키 누락을 검사합니다.

## k-skill 동기화

```bash
pnpm --filter @jk-external-api/catalog sync
```

동기화는 GitHub tree와 `SKILL.md` frontmatter를 읽고 수동 보정을 병합한 뒤 임시 파일을 원자적으로 교체합니다. GitHub rate limit, 잘못된 frontmatter, 잘린 tree에서는 기존 스냅샷을 바꾸지 않습니다. QA fixture는 실제 스킬이 아니므로 제외하고, `legacy/unsupported-skills` 문서는 `legacy-*` ID로 보존합니다.

매주 월요일 09:00 KST workflow는 변경을 바로 공개하지 않고 검토 PR을 만들며, 링크나 운영 미리보기 장애는 이슈를 엽니다.

## 배포

- `main`은 GitHub의 공식 Pages artifact workflow로 정적 사이트를 배포합니다.
- Worker는 `workflow_dispatch`와 GitHub `production` Environment 승인을 모두 통과해야 배포됩니다.
- 저장소 변수 `PUBLIC_PREVIEW_API_BASE_URL`에는 첫 Worker 배포 후 `workers.dev` 주소를 등록합니다.
- Cloudflare API 자격증명과 세 API 키는 GitHub Environment secret과 Cloudflare Worker Secret으로만 취급합니다.

필요 secret: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATA_GO_KR_API_KEY`, `KAKAO_REST_API_KEY`, `KOPIS_SERVICE_KEY`.

## 이용조건

코드와 자체 문서는 [MIT](LICENSE)입니다. 외부 정보와 번들 폰트의 권리·귀속은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 및 각 공식 링크를 따릅니다. 실제 서비스 전에는 각 제공기관의 최신 이용조건, 호출 한도, 표시 의무를 다시 확인하세요.
