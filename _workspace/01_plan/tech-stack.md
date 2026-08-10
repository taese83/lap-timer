# Tech Stack — minicar-laptime

Source: `_workspace/01_plan/project-brief.md`(v3, 확정) §0, §6. 정확 패키지 semver는 brief에 없어 하네스 canonical pin(`.claude/skills/project-init/assets/templates.md`)을 ASSUMPTION으로 채택했다.

## Profile

- **WEB_PROFILE: `react-vite-spa`(고정, brief §0)** — client-only, 루트 `api/` 디렉토리 없음(hybrid/next profile과 상호 배타적으로 감지됨, `web-profile-contract.md`).
- **AI_MODE: false** — 온디바이스 결정론적 CV(zero-dependency Worker), 외부 AI/서버 모델 없음.
- **LOCAL_DOMAIN_STATE_MODE: true** — IndexedDB(`idb`)로 세션/랩을 영속화, 서버 없음.
- 나머지 capability: false(brief §0).

## 실행 프로필 잠금(다음 단계 참고)

이 문서는 profile을 문서화만 한다. 실제 `project-profile.json` 잠금은 orchestrator/tech-advisor가 아래 명령으로 수행한다(이번 ingestion 범위 아님):

```bash
node .claude/scripts/web-core/resolve-profile.mjs --project-root {project-root} --requested react-vite-spa --provider vercel --deployment static-cdn
```

## Toolchain(핀 고정)

- Node 22.22.3(nvm)
- pnpm 11.18.0(npm 전역, PATH 우선) — 11.13.0은 broken release, pin 금지(하네스 공통 제약, `CLAUDE.md`/memory와 일관)
- TypeScript strict mode(brief §6)

## 의존성 매트릭스(ASSUMPTION — 정확 semver는 brief에 없어 하네스 canonical pin 채택)

brief는 라이브러리명만 지정한다(react-vite-spa, Zustand, idb, Vitest). 이 앱은 폼/라우팅/서버통신/UI킷이 불필요하므로 하네스 canonical 템플릿(`project-init/assets/templates.md`)에서 해당 항목을 제외하고 필요한 항목만 채택한다.

| 패키지 | 버전 | 근거 |
|---|---|---|
| `react` | 19.2.7 | 하네스 canonical pin |
| `react-dom` | 19.2.7 | 하네스 canonical pin |
| `zustand` | 5.0.11 | 하네스 canonical pin, brief §6 명시 |
| `idb` | ASSUMPTION — 정확 patch 미고정 | brief §6 명시(라이브러리명만), canonical pin 부재. 구현 시 `pnpm add idb@latest` 후 lockfile 고정 |
| `typescript` | 6.0.0 | 하네스 canonical pin, brief §6 "TS strict" |
| `vite` | 8.1.4 | 하네스 canonical pin |
| `vitest` | 4.1.0 | 하네스 canonical pin, brief §6 명시 |
| `@vitejs/plugin-react` | 6.0.3 | 하네스 canonical pin |
| `@vitest/coverage-v8` | 4.1.0 | 하네스 canonical pin |
| `eslint` / `@eslint/js` / `typescript-eslint` / `eslint-plugin-jsx-a11y` / `eslint-plugin-react-hooks` / `globals` | 9.39.5 / 9.39.5 / 8.57.0 / 6.10.2 / 7.0.1 / 16.5.0 | 하네스 canonical pin 세트 |
| `prettier` | 3.8.1 | 하네스 canonical pin |
| `jsdom` | 29.0.0 | 하네스 canonical pin(테스트 환경) |
| `@testing-library/react` / `@testing-library/jest-dom` / `@testing-library/user-event` | 16.3.0 / 6.6.3 / 14.6.1 | 하네스 canonical pin |
| `@types/react` / `@types/react-dom` | 19.2.0 / 19.2.0 | 하네스 canonical pin |
| `@playwright/test` | 1.61.0 | e2e·실기기 인접 시나리오, `DEPLOY_ONLY` 검증용 |
| `@axe-core/playwright` | 4.11.0 | 접근성 baseline(NFR-8, ASSUMPTION) |
| `husky` | 9.1.7 | 하네스 canonical pin(pre-commit hook) |

**제외**(brief 범위상 불필요 — 서버/폼/라우팅/UI킷 없음): `@mui/material`, `@emotion/*`, `@tanstack/react-query`, `axios`, `react-hook-form`, `@hookform/resolvers`, `zod`, `date-fns`, `web-vitals`, `msw`(호출할 외부 API 자체가 없음). `react-router`도 제외(ASSUMPTION B2, `gap-report.md` — 3화면을 in-app view state로 처리, URL 라우팅 불요. 필요성이 확인되면 재검토).

## CV 엔진

- zero-dependency 순수 TS Worker(brief §6) — 외부 CV/ML 라이브러리 사용 금지. 차분율 + burst 검출 + HSV 히스토그램만 구현(~200줄, brief §2).
- Worker는 `getUserMedia` 프레임을 받아 `ImageData`/`OffscreenCanvas` 기반으로 처리한다. 구체 캔버스 API 선택은 Phase3 구현 세부이며, 이 문서는 "외부 CV 의존성 0" 제약만 고정한다.

## 배포

- Vercel 정적(HTTPS) — brief §6(L98)에 명시되었으나 **선택 사항으로 해석**(ASSUMPTION B5, `gap-report.md` — 상위 지시 "deployment=Vercel 정적(선택)" 반영, brief §6과 표면상 다르나 최신 지시 우선 원칙에 따름, CONFLICT 아님·해석 명확화).
- `getUserMedia`는 secure context 필수이므로 로컬 개발은 HTTPS dev server 또는 `localhost` 예외를 활용하고, 실배포 시 Vercel `static-cdn` target을 사용한다.
- 루트 `api/` 디렉토리 없음 → `react-vite-spa` profile 자동 감지 조건 충족(`web-profile-contract.md`).

## 테스트 전략

- Vitest: 합성 fixture 기반 CV 로직 단위 테스트(brief §9의 fixture 목록을 그대로 테스트 스위트 골격으로 사용) — `LOCAL_VERIFIABLE`.
- IndexedDB 단위 테스트: `idb` 로직을 in-memory/fake IndexedDB 구현으로 검증(ASSUMPTION — 정확 도구 미지정, 구현 시 선택) — `LOCAL_VERIFIABLE`.
- Playwright: UI 상호작용/접근성(axe-core) 검증 — `LOCAL_VERIFIABLE`(브라우저 자동화 범위 내에서).
- 실기기 카메라/토치/Wake Lock/실촬영 회귀(brief §9, tamiya real-motors 패턴): `DEPLOY_ONLY` — 로컬 자동화 불가, 실기기·실트랙 촬영 필요.

## Source Trace

| 절 | Source |
|---|---|
| Profile/모드 | `project-brief.md` §0(L9-13) |
| Toolchain 핀 | `project-brief.md` §6(L94-98) + 하네스 CLAUDE.md/memory 공통 제약 |
| 의존성 매트릭스 | `project-brief.md` §6(L94-98, 라이브러리명) + `.claude/skills/project-init/assets/templates.md`(정확 버전, ASSUMPTION) |
| CV 엔진 | `project-brief.md` §2 파이프라인(L47-55), §6(L96-97) |
| 배포 | `project-brief.md` §6(L98) + 상위 오케스트레이터 지시(선택 사항 명시) |
| 테스트 전략 | `project-brief.md` §9(L118-124) |
