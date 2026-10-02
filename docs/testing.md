# Testing Strategy & Evidentiary Verification

> Technical documentation of the OSINTiger test harness, offline mocking philosophy, and evidentiary verification proofs.

---

## 1. Testing Philosophy

In an intelligence platform, correctness is not merely a software requirement; it is an analytical necessity. Incorrect input parsing, flawed hypothesis evaluation, or silent error propagation can lead to false positives or missed threat indicators.

The OSINTiger test suite is engineered around three non-negotiable principles:

1. **Zero Secret Dependency**: Every test executes cleanly on a fresh clone with zero environment variables, zero paid API keys, and zero external network calls.
2. **Deterministic Mocking**: All external intelligence sources are mocked using representative telemetry payloads, ensuring reproducible execution in CI pipelines.
3. **High-Risk Domain Coverage**: Tests focus on core analytical algorithms: target detection, source routing, hypothesis scoring, credential encryption, and attribution validation.

---

## 2. Test Suite Breakdown (18 Suites, 308 Passing Tests)

| Test Suite File | Domain Area | Key Claims & Behaviors Verified |
|---|---|---|
| `attribution.test.ts` | Zero-Hallucination Guardrails | Validates that all findings contain `[SOURCE: ..., URL: ...]` tags. Asserts that missing or malformed tags immediately trip the `attribution_valid: false` flag and enforce manual review. |
| `confidence-engine.test.ts` | Multi-Dimensional Scoring | Verifies Admiralty/NATO reliability tier classifications (Tiers 1-5). Tests cross-source corroboration, timestamp freshness decay, and overall confidence bounds. |
| `llm-security.test.ts` | Cryptographic Security | Asserts AES-256-GCM encryption at rest for user API keys. Tests IV uniqueness, auth tag validation, tampering rejection, and in-memory decryption. |
| `detector.test.ts` | Target Identification | Exhaustive regex and heuristic tests across 11 target types: IPv4/IPv6, SHA-256/MD5/SHA-1 hashes, CVE identifiers, Ethereum wallets, Bitcoin addresses, domains, and phone numbers. |
| `ach.test.ts` | Competing Hypotheses | Validates Richards Heuer ACH matrix generation, evidence diagnostic weighting, and hypothesis consistency calculation. |
| `router.test.ts` | Source Routing Matrix | Confirms that input types route strictly to compatible sources from the 74-collector registry without erroneous cross-type queries. |
| `safe-error.test.ts` | Information Leakage Protection | Asserts that internal database connection strings, credentials, and raw stack traces are stripped before returning HTTP 500 error responses in production. |
| `data-integrity.test.ts` | Atomic State & Rollbacks | Verifies transaction boundaries, rollback behavior on database failures, and prevention of partial investigation states. |
| `safe-json.test.ts` | Defensive Parsing | Validates resilient JSON parsing with schema fallbacks for unformatted or truncated model responses. |
| `store.test.ts` | Investigation Persistence | Tests in-memory cache lifecycle, TTL expiration, database persistence, and tagging. |
| `playbooks.test.ts` | Automated Workflows | Verifies pre-configured investigation playbooks (Executive Protection, Infrastructure Takedown, Sanctions Screening). |
| `plans.test.ts` & `entitlements.test.ts` | Quota & Access Gates | Validates usage meters, plan tiers (Community, Professional, Enterprise), feature gating, and token limits. |
| `auth-utils.test.ts` | Authentication Security | Verifies bcrypt password hashing, salt uniqueness, and constant-time verification. |
| `router.test.ts` & `registry.test.ts` | SPA Route Safety | Verifies hash serialization/deserialization across all 67 client route variants. |

---

## 3. Running the Test Suite Locally

```bash
# Execute the full automated test suite
npm test

# Run tests in watch mode during development
npm run test:watch

# Generate code coverage metrics
npm run test:coverage
```

### Expected Output
```text
✓ src/lib/osint/__tests__/store.test.ts (12 tests)
✓ src/lib/osint/__tests__/confidence-engine.test.ts (7 tests)
✓ src/lib/osint/__tests__/safe-json.test.ts (23 tests)
✓ src/lib/osint/__tests__/detector.test.ts (21 tests)
✓ src/lib/router/__tests__/registry.test.ts (11 tests)
✓ src/lib/osint/__tests__/router.test.ts (11 tests)
✓ src/lib/osint/__tests__/playbooks.test.ts (10 tests)
✓ src/lib/osint/__tests__/attribution.test.ts (3 tests)
✓ src/lib/osint/__tests__/ach.test.ts (8 tests)
✓ src/lib/saas/__tests__/notifications.test.ts (6 tests)
✓ src/lib/saas/__tests__/plans.test.ts (46 tests)
✓ src/lib/osint/__tests__/api-handler.test.ts (14 tests)
✓ src/lib/osint/__tests__/safe-error.test.ts (17 tests)
✓ src/lib/osint/__tests__/data-integrity.test.ts (30 tests)
✓ src/lib/router/__tests__/router.test.ts (26 tests)
✓ src/lib/saas/__tests__/entitlements.test.ts (49 tests)
✓ src/lib/osint/__tests__/llm-security.test.ts (6 tests)
✓ src/lib/__tests__/auth-utils.test.ts (8 tests)

Test Files  18 passed (18)
     Tests  308 passed (308)
```
