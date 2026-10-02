# Technical & Architectural Quick-Review

> A 3-minute architectural overview and hiring signals guide for engineering managers and technical interviewers reviewing OSINTiger.

---

## What Is OSINTiger?

OSINTiger is an open-source intelligence (OSINT) and threat-intelligence analysis platform that harvests publicly available telemetry across 74 distinct providers, normalizes the data into canonical schemas, evaluates competing hypotheses using Richards Heuer's analytical methodology, and synthesizes structured intelligence reports with transparent, immutable source attribution.

---

## Top 6 Engineering Signals

| Signal | What It Demonstrates | Where to Inspect in Code |
|---|---|---|
| **1. Resilient Async Pipeline** | High-throughput parallel querying of 74 public APIs with individual timeouts, graceful partial-failure degradation, and status polling. | [`src/lib/osint/pipeline.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/pipeline.ts) and [`src/lib/osint/source-runner.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/source-runner.ts) |
| **2. Zero-Hallucination Protocol** | Rejects ungrounded AI claims by enforcing explicit `[SOURCE: <name>, URL: <url>]` citations across all findings with automated regex parsing. | [`src/lib/osint/attribution.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/attribution.ts) and [`attribution.test.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/__tests__/attribution.test.ts) |
| **3. Immutable Evidence Provenance** | Cryptographic chain of custody: hashes raw API responses with SHA-256 upon ingestion and records audit trails across 10 provenance dimensions. | [`src/lib/osint/provenance.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/provenance.ts) |
| **4. Cryptographic Credential Safety** | Protects user-supplied BYO-LLM API keys at rest using AES-256-GCM with unique 16-byte IVs, auth tags, and scrypt key derivation. | [`src/lib/osint/llm-provider.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/llm-provider.ts) and [`llm-security.test.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/__tests__/llm-security.test.ts) |
| **5. Cognitive Analysis Frameworks** | Implements the CIA's Richards Heuer Analysis of Competing Hypotheses (ACH) and an adversarial Advocate vs Skeptic debate engine. | [`src/lib/osint/ach.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/ach.ts) and [`src/lib/osint/multi-agent-debate.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/multi-agent-debate.ts) |
| **6. Testing & Quality Discipline** | 18 automated test suites asserting 308 tests across target detection, confidence models, encryption, and data integrity with zero required secrets. | [`src/lib/osint/__tests__/`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/__tests__/) |

---

## Quick Navigation: Where to Look

- **Orchestration Logic**: [`src/lib/osint/pipeline.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/pipeline.ts)
- **Target Detection**: [`src/lib/osint/detector.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/detector.ts)
- **Source Routing**: [`src/lib/osint/router.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/router.ts)
- **Confidence & Admiralty Engine**: [`src/lib/osint/confidence-engine.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/confidence-engine.ts)
- **Credential Encryption**: [`src/lib/osint/llm-provider.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/osint/llm-provider.ts)
- **Hash Router State Machine**: [`src/lib/router/router.ts`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/src/lib/router/router.ts)
- **Prisma Schema**: [`prisma/schema.prisma`](file:///c:/Projects/3.%20PERSONAL/OSINTiger/prisma/schema.prisma)

---

## Architectural Decision Highlights

- **Why a Hash-Based Client Router?** Prevents component unmounting and maintains persistent WebSocket and polling loops while navigating complex multi-tab intelligence records.
- **Why AES-256-GCM?** Provides authenticated encryption guaranteeing both confidentiality and tamper detection for sensitive third-party API keys stored in SQLite.
- **Why Multi-Tier Reliability (NATO/Admiralty)?** Prevents unverified forum scrapes or community comments from carrying the same evidentiary weight as authoritative government registries (SEC EDGAR, OFAC).
