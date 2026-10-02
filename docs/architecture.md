# OSINTiger: System Architecture & Technical Topology

> Deep-dive architectural specification of the OSINTiger open-source intelligence and threat-research platform.

---

## 1. System Topology Overview

OSINTiger is architected as an evidence-first intelligence collection, normalization, correlation, and synthesis system. It decouples deterministic data harvesting from AI-assisted inference, ensuring every reported conclusion is grounded in verifiable public telemetry.

```
+---------------------------------------------------------------------------------------+
|                                    User Interface                                     |
|           (Next.js React 19 Client · Hash-Based SPA Router · JetBrains Mono)          |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                         API Gateway & Security Middleware                             |
|   - Rate Limiting (In-memory token bucket per IP/token)                               |
|   - Security Headers (CSP, HSTS, X-Content-Type-Options)                              |
|   - Body Size Inspection & Safe Error Transformer (safe-error.ts)                     |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                       Investigation Orchestration Engine                              |
|                                                                                       |
|   [Target Detector]           [Source Router]               [Execution Modes]         |
|   Regex & heuristic matching  74 collectors across 11       - 8-Step Sequential       |
|   (IP, Domain, Hash, CVE,     categories mapped to target   - Recursive Agent         |
|   Wallet, Org, Phone, Email)  types                         - Discovery Tree          |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                       Telemetry Collection & Harvesting Tier                          |
|                                                                                       |
|   [Authoritative Tier 5]      [Threat Intel Tier 4]       [Registries Tier 3]         |
|   SEC EDGAR, OFAC, NVD,       VirusTotal, AbuseIPDB,      crt.sh, DNS-over-HTTPS,     |
|   CISA KEV, Interpol          AlienVault OTX, GreyNoise   OpenCorporates, ICIJ        |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                    Evidence Normalization & Integrity Pipeline                        |
|                                                                                       |
|   [Normalizer]            [Confidence Engine]         [Attribution Validator]         |
|   Canonical data models   5-dimension scoring model   Enforces [SOURCE: ..., URL: ...] |
|   and structural mapping  weighted by reliability     flags unsourced statements      |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                      Synthesis & Cognitive Processing Tier                            |
|                                                                                       |
|   [Richards Heuer ACH Matrix]              [Multi-Agent Adversarial Debate]           |
|   Analysis of Competing Hypotheses         Advocate vs Skeptic debate rounds          |
|   matrix with diagnostic consistency       with evidentiary arbitration               |
|                                                                                       |
|   [BYO-LLM Provider Engine]                                                           |
|   AES-256-GCM encrypted key storage · OpenAI / Anthropic / Local fallback routing     |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                      Persistence & Audit Ledger (Prisma ORM)                          |
|                                                                                       |
|   - SQLite local datastore (configurable to PostgreSQL via Prisma provider)           |
|   - Immutable Provenance Events (SHA-256 raw payload hashes)                          |
|   - Knowledge Base Graph (Entities, Typed Relationships, Corroborating Evidence)      |
+---------------------------------------------------------------------------------------+
```

---

## 2. 8-Step Investigation Lifecycle

Every standard investigation flows through a deterministic state machine managed by `src/lib/osint/pipeline.ts`:

1. **Target Detection (`parse`)**: Analyzes raw input strings using `src/lib/osint/detector.ts` across 11 target types (Domain, IPv4/IPv6, SHA-256/MD5/SHA-1 Hash, CVE, Ethereum Wallet, Bitcoin Address, Organization Name, Person Name, Phone Number, Email Address, Social Handle).
2. **Source Selection (`route`)**: Consults `src/lib/osint/router.ts` to identify all compatible sources from the 74-collector registry. Filters out unavailable sources and applies rate-limit quotas.
3. **Parallel Source Query (`query`)**: Dispatches asynchronous requests with individual 10-second timeout guardrails. Failures in one provider do not halt overall execution.
4. **Data Normalization (`normalize`)**: Maps disparate third-party JSON/XML responses into uniform `NormalizedFinding` interfaces with canonical entity names and timestamp normalization.
5. **AI Synthesis (`synthesize`)**: Sends normalized evidence to the active LLM provider (OpenAI, Anthropic, or default engine) with strict prompt instructions requiring structured JSON outputs and explicit citations.
6. **Hypothesis Evaluation (`ach`)**: Constructs an Analysis of Competing Hypotheses (ACH) matrix based on Richards Heuer's CIA analytical methodology, testing evidence diagnostics across competing scenarios.
7. **Attribution Audit (`attribute`)**: Runs `src/lib/osint/attribution.ts` against the synthesis. Every sentence must match the regex `[SOURCE: <label>, URL: <url>]`. If unsourced claims are detected, the report is flagged for manual analyst review (`attribution_valid: false`).
8. **Report Formatting & Ingestion (`format`)**: Persists the final structured intelligence report to the database, publishes an immutable `ProvenanceEvent` with a SHA-256 hash of the evidence, and indexes findings into the Knowledge Base graph.

---

## 3. Data Flow & Provenance Architecture

To satisfy rigorous threat-intelligence provenance standards, OSINTiger records an unbroken chain of custody for every piece of intelligence:

### Provenance Tracking Model (`src/lib/osint/provenance.ts`)
- **Raw Payload Hashing**: Every external API response is hashed immediately upon receipt using SHA-256 (`rawHash`). This proves the raw data was not modified during post-processing.
- **Collector Context**: Tracks subsystem name, collector version, execution timestamp, exact query string, and canonicalization method.
- **Transformation Trail**: Records normalization version, field mapping transformations, and confidence propagation calculations.
- **Integrity Validation**: If an analyst questions a conclusion, the system allows one-click trace resolution from high-level report finding -> provenance event -> raw API response payload.

---

## 4. Multi-Agent Adversarial Debate

Rather than accepting single-pass generative AI summaries, OSINTiger implements an adversarial multi-agent debate protocol (`src/lib/osint/multi-agent-debate.ts`):

- **The Advocate**: Evaluates evidence to support the primary hypothesis (e.g., active malicious campaign).
- **The Skeptic**: Evaluates alternative explanations (e.g., shared hosting artifact, stale DNS record, false positive indicator).
- **The Arbiter**: Synthesizes arguments, weighs the reliability tier of each cited source, and assigns probabilistic confidence based strictly on corroborated evidence.

---

## 5. Security & Cryptographic Isolation

### BYO-LLM Key Encryption (`src/lib/osint/llm-provider.ts`)
- User-supplied API keys for OpenAI and Anthropic are encrypted before database insertion using **AES-256-GCM**.
- Key derivation uses `scryptSync` with an application salt.
- Every record stores a unique 16-byte initialization vector (IV) and a 16-byte authentication tag.
- Decryption happens exclusively in server memory during outbound API dispatch; plaintext keys are never returned across API boundaries or recorded in logs.

### Safe Error Sanitization (`src/lib/osint/safe-error.ts`)
- All uncaught route exceptions are trapped by central error handlers.
- Internal database URLs, credentials, and full stack traces are stripped before serializing client responses in production.
