# ForceLab: ISO/IEC 25010 Compliance and DevSecOps Architecture

Technical annex to the master report. It records what the repository does today
and, separately, what is known to be missing. Nothing here is aspirational.

- **Scope:** web application `forcelab-app` (Next.js 16, Supabase, Vercel).
- **Branching:** work on `develop`, promote to `main` through a pull request.
- **Last reviewed:** Sprint 2 close (2026-11-20).

---

## 1. ISO/IEC 25010 product quality

ISO/IEC 25010 defines eight product quality characteristics. For each one: the
control that addresses it, where the evidence lives, and its current status.

| Characteristic | Control in ForceLab | Evidence | Status |
| :--- | :--- | :--- | :--- |
| **Functional suitability** | Scientific rules are pure functions with exhaustive unit tests: hybrid e1RM (Brzycki + high-rep dampening), Bilbo cycle, 4-week heavy blocks, double and linear progression. | `src/lib/math/__tests__/` | Met |
| **Performance efficiency** | Public pages are statically prerendered; authenticated pages stream behind `<Suspense>`. No server nonce is used on purpose, so static pages stay static (see 3.2). Chart data is limited to 2000 sets. | `next build` route table, `src/app/**/page.tsx` | Partial: no performance budget or Lighthouse gate yet |
| **Compatibility** | Mobile-first responsive UI; standard Web APIs only; PWA support planned for Sprint 6. | Tailwind responsive classes | Partial: no cross-browser test matrix |
| **Usability** | Spanish-only UI, one-tap RIR and speed selectors, pre-filled suggested weight, rest timer, validation messages in Spanish. | `src/components/workout/`, `src/lib/validation/schemas.ts` | Met by design; no formal usability test yet |
| **Reliability** | Typed inputs, validation before every write, errors surfaced to the user instead of failing silently, idempotent migrations. | `src/lib/validation/`, `goalActions.ts` | Partial: no offline queue (Sprint 6); cycle advance runs in the browser (FUTURE_IMPROVEMENTS #3) |
| **Security** | Section 2. | Section 2 | Partial: see known limits |
| **Maintainability** | TypeScript strict mode, ESLint, a single source of truth per rule, English code and Spanish UI, architecture rules in `CLAUDE.md`, SonarCloud analysis. | `tsconfig.json`, `eslint.config.mjs`, `sonar-project.properties` | Met |
| **Portability** | Serverless deployment on Vercel, configuration through environment variables, no host-specific code. | `vercel.json`, `.env.local` convention | Met |

### 1.1 Measurable targets

| Metric | Target | Enforced by |
| :--- | :--- | :--- |
| Statement, line and function coverage of scientific and validation code | >= 95% | `vitest.config.mts` thresholds (CI fails below) |
| Branch coverage of the same code | >= 90% | `vitest.config.mts` thresholds |
| TypeScript errors | 0 | `npm run typecheck` |
| ESLint errors and warnings | 0 | `npm run lint` |
| Known high or critical dependency vulnerabilities | 0 | `npm audit --audit-level=high` |
| Leaked secrets in history | 0 | gitleaks |

Coverage is measured over `src/lib/math`, `src/lib/validation` and the pure
analytics and matching modules. UI components are not part of the threshold.

---

## 2. Security (OWASP)

### 2.1 Controls by OWASP Top 10 (2021)

| Risk | Control | Where |
| :--- | :--- | :--- |
| **A01 Broken access control** | Row Level Security on every table with policies scoped to `auth.uid()`. Route protection in the proxy; server pages re-check the user. | Supabase policies, `src/proxy.ts`, `src/lib/supabase/middleware.ts` |
| **A02 Cryptographic failures** | HSTS with preload and `upgrade-insecure-requests` in production; session cookies managed by `@supabase/ssr`. | `next.config.ts` |
| **A03 Injection** | Zod validation of every user input before it reaches Supabase; the client uses parameterized queries; no `dangerouslySetInnerHTML`; CSP limits script sources. | `src/lib/validation/schemas.ts` |
| **A04 Insecure design** | Validation limits mirror database constraints (`numeric(5,2)`, rir 0-5, enums). Realistic ceilings (600 kg per lift) block typo-sized values. | `schemas.ts` |
| **A05 Security misconfiguration** | Security headers in `next.config.ts`; `X-Powered-By` removed; least-privilege CI permissions. | `next.config.ts`, `devsecops-ci.yml` |
| **A06 Vulnerable components** | `npm audit` in CI; dependency set kept small. | CI job `security-audit` |
| **A07 Authentication failures** | Supabase Auth; the server validates the session with `getUser()`, never with `getSession()` alone. | `middleware.ts` |
| **A08 Software and data integrity** | `npm ci --ignore-scripts` from a lockfile (dependency lifecycle scripts never run in CI); third-party actions pinned to a full commit SHA; Semgrep pinned to an exact version; gitleaks on every push. | CI |
| **A09 Logging and monitoring** | Partial: database errors are logged to the console and shown to the user. No central monitoring yet. | Known gap |
| **A10 SSRF** | Not applicable: the application makes no server-side requests to user-supplied URLs. | n/a |

### 2.2 HTTP security headers

Set for every route in `next.config.ts`:

| Header | Value | Purpose |
| :--- | :--- | :--- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS |
| `X-Frame-Options` | `DENY` | Anti-clickjacking (legacy browsers) |
| `X-Content-Type-Options` | `nosniff` | Disable MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | camera, microphone, geolocation, payment, usb, interest-cohort disabled | Remove unused browser capabilities |
| `Content-Security-Policy` | See 2.3 | Restrict resource origins |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolate the browsing context |
| `X-DNS-Prefetch-Control` | `off` | Avoid speculative DNS lookups |

### 2.3 Content-Security-Policy

```text
default-src 'self'
script-src 'self' 'unsafe-inline'            (+ 'unsafe-eval' in development only)
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob: https://*.supabase.co
connect-src 'self' https://*.supabase.co wss://*.supabase.co <project origin>
frame-src 'none'; frame-ancestors 'none'; object-src 'none'
base-uri 'self'; form-action 'self'
upgrade-insecure-requests                    (production only)
```

### 2.4 Known limits (stated so they can be scheduled)

1. **`'unsafe-inline'` for scripts and styles.** A nonce-based policy is stricter,
   but Next.js only applies nonces to dynamically rendered pages, which would turn
   the static landing, `/login` and `/register` into per-request renders. The
   trade-off was chosen deliberately. Mitigations: no `dangerouslySetInnerHTML`,
   Zod validation, and React's output escaping. Revisit with Subresource
   Integrity (experimental in Next.js) when it stabilizes.
2. **Policies must be checked against the live site.** CSP breakage (the chart,
   Supabase calls) only shows in a browser console and is not covered by automated tests.
3. **Moderate dependency advisories** in `shadcn` (a CLI that the CSS import keeps
   as a dependency). Below the CI threshold (`high`); tracked, not ignored.
4. **No rate limiting** beyond what Supabase Auth provides.
5. **Validation is client-side.** It guards the user experience and normalizes
   data, but the real enforcement is RLS and the database constraints, because a
   direct API call bypasses any browser code. Server-side validation arrives with
   the Server Actions planned in FUTURE_IMPROVEMENTS #3.

---

## 3. DevSecOps pipeline

File: `.github/workflows/devsecops-ci.yml`. It runs on every push and pull
request to `develop` and `main`, with three parallel jobs and `contents: read`
permissions.

```text
push / pull_request (develop, main)
   |
   +-- quality-and-tests : npm ci --ignore-scripts -> lint -> typecheck -> test:coverage -> build
   |
   +-- security-audit    : npm audit (high) -> gitleaks (secrets) -> Semgrep (SAST)
   |
   +-- sonarcloud        : test:coverage -> SonarCloud scan (strict when SONAR_TOKEN exists)
```

| Stage | Tool | Fails the run when |
| :--- | :--- | :--- |
| Static quality | ESLint, `tsc --noEmit` | Any error or warning |
| Unit tests | Vitest + v8 coverage | A test fails or coverage drops below the thresholds |
| Build | `next build` | The build or its TypeScript check fails |
| SCA | `npm audit --audit-level=high` | A high or critical advisory appears |
| Secrets | gitleaks | A secret is found in the history |
| SAST | Semgrep (`p/security-audit`, `p/typescript`, `p/nextjs`, `p/owasp-top-ten`) | A finding is reported |
| Quality gate | SonarCloud | The scan or its quality gate fails |

### 3.1 Required repository secrets

| Secret | Used by | Notes |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | build | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build | The public client key. The application reads it as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; the workflow maps one to the other |
| `SONAR_TOKEN` | sonarcloud | Without it the scan is skipped with a notice, not failed |
| `GITLEAKS_LICENSE` | security-audit | Needed only if the repository belongs to an organization |

### 3.2 Decisions

- **SonarCloud is skipped, not softened.** With no token the step is omitted; with a
  token it is strict. This avoids `continue-on-error`, which would also hide real failures.
- **No nonce-based CSP.** See 2.4 item 1.
- **Semgrep runs from pip**, pinned to an exact version and installed with `--only-binary :all:`
  so no setup script runs. It is not a marketplace action, so it works in private
  repositories without a Semgrep account.
- **Supply-chain hardening.** Every third-party action is pinned to a full commit SHA
  (the tag is kept in a comment), and `npm ci` runs with `--ignore-scripts`. Both were
  raised by SonarCloud on the first run (rules S6505, S7637, S8541, S8544).
- **`typecheck` runs `next typegen` first.** Next.js generates global types such as
  `LayoutProps` during the build; without that step a clean checkout fails to type-check.

---

## 4. Local verification

Run before every commit to `develop`:

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

## 5. Pending work

| Item | Reference |
| :--- | :--- |
| Server-side validation through Server Actions | FUTURE_IMPROVEMENTS #3 |
| Stable exercise identifiers instead of name matching | FUTURE_IMPROVEMENTS #2 |
| Browser check of the CSP on every page | Section 2.4, item 2 |
| Performance budget and Lighthouse gate | Sprint 6 |
| Central error monitoring | Section 2.1, A09 |
