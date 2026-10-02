# Architectural Decision Records (ADRs)

This document records the major architectural decisions, tradeoffs, and rejected alternatives evaluated during the engineering of OSINTiger.

---

## ADR 01: Hash-Based Single-Page Router vs Server-Side App Routing

- **Status**: Accepted
- **Context**: OSINT investigations involve intensive real-time state: live SSE/polling progress feeds, multi-tab intelligence views, dynamic SVG link graphs, and interactive hypothesis matrices. Transitioning between views using standard Next.js server-rendered routes would trigger repeated page unmounts and teardown of active WebSocket/polling loops.
- **Decision**: Implement a custom type-safe hash router (`src/lib/router/`) using `window.location.hash` with a centralized 67-route discriminated union.
- **Tradeoffs & Alternatives**:
  - *Alternative Considered*: Standard Next.js file-based routing (`/investigate/[id]`, `/kb`, `/billing`).
  - *Why Rejected*: Full route transitions caused component unmounting, lost ephemeral filter state, and required complex hydration synchronization for active investigations.
  - *Tradeoff*: Search engines do not crawl hash routes as individual pages. This is an acceptable tradeoff because OSINTiger is an authenticated investigation console, not a public content site.

---

## ADR 02: AES-256-GCM Encryption at Rest for BYO-LLM Credentials

- **Status**: Accepted
- **Context**: Analysts frequently bring their own API keys (OpenAI, Anthropic) for private LLM synthesis. Storing these credentials in plaintext in the database would create catastrophic exposure if SQLite backups or database snapshots were ever compromised.
- **Decision**: Encrypt all user-supplied provider keys using AES-256-GCM authenticated encryption before persisting to SQLite.
- **Implementation**:
  - Key derivation uses `scryptSync` with an application salt.
  - A cryptographically random 16-byte initialization vector (IV) is generated for each key.
  - Ciphertext is stored as `iv:authTag:encryptedBytes` in hex.
  - Decryption happens exclusively in server memory during outbound API calls.
- **Tradeoffs & Alternatives**:
  - *Alternative Considered*: Hashicorp Vault or cloud KMS.
  - *Why Rejected*: Overly complex external dependency for a self-hosted or single-server deployment.
  - *Tradeoff*: Key security relies on the secrecy of the server-side `LLM_ENCRYPTION_KEY` environment variable.

---

## ADR 03: Richards Heuer Analysis of Competing Hypotheses (ACH)

- **Status**: Accepted
- **Context**: Human analysts and generative AI models are both susceptible to confirmation bias: latching onto an early intuitive hypothesis and ignoring contradictory evidence.
- **Decision**: Integrate Richards Heuer's CIA methodology (Analysis of Competing Hypotheses) directly into the synthesis pipeline (`src/lib/osint/ach.ts`).
- **Implementation**:
  - Generate 2 to 4 mutually exclusive hypotheses for each investigation.
  - Build an N x M matrix mapping every normalized evidence item against all hypotheses.
  - Evaluate whether evidence is *Consistent*, *Inconsistent*, or *Neutral*.
  - Invert traditional scoring: hypotheses with the fewest inconsistencies are rated most probable.
- **Tradeoffs & Alternatives**:
  - *Alternative Considered*: Single-summary LLM prose generation.
  - *Why Rejected*: Generative models frequently hallucinate confident single narratives without exploring counter-explanations.

---

## ADR 04: Zero-Hallucination Protocol via Strict Citation Enforcement

- **Status**: Accepted
- **Context**: In threat intelligence and legal compliance, a hallucinated finding (e.g., falsely claiming a domain is on a sanctions list) can have severe legal and operational consequences.
- **Decision**: Enforce a programmatic zero-hallucination validation check (`src/lib/osint/attribution.ts`).
- **Implementation**:
  - The synthesis prompt requires every factual statement to include an explicit citation: `[SOURCE: <name>, URL: <url>]`.
  - Post-synthesis code parses every sentence via regex.
  - If any finding lacks a valid citation, `attribution_valid` is set to `false`, and `needs_manual_review` is set to `true`.
  - The UI displays amber warning banners and flags unverified claims.
- **Tradeoffs & Alternatives**:
  - *Alternative Considered*: Relying on LLM system prompt instructions without automated validation.
  - *Why Rejected*: Prompts alone are probabilistic; automated code validation provides deterministic guardrails.

---

## ADR 05: Immutable SHA-256 Provenance Ledger

- **Status**: Accepted
- **Context**: Intelligence reports must be auditable and reproducible. If an external source changes or deletes a record after an investigation, the analyst must be able to prove what raw data was observed at query time.
- **Decision**: Record append-only `ProvenanceEvent` records containing SHA-256 hashes of the exact raw API payloads (`src/lib/osint/provenance.ts`).
- **Tradeoffs & Alternatives**:
  - *Alternative Considered*: Storing only high-level summary conclusions.
  - *Why Rejected*: Prevents forensic verification and undermines evidentiary credibility.
  - *Tradeoff*: Moderately increases database storage footprint. Managed via automated 90-day retention policies.

---

## ADR 06: Multi-Tier Source Reliability Model (NATO / Admiralty Code)

- **Status**: Accepted
- **Context**: Not all OSINT sources are equally trustworthy. A DNS-over-HTTPS response from an authoritative root server is more reliable than a comment on a forum.
- **Decision**: Adopt the Admiralty System / NATO STANAG source evaluation principles, categorizing all 74 sources into 5 distinct reliability tiers:
  - **Tier 5 (Authoritative)**: Government registries, formal standards bodies (SEC EDGAR, OFAC, NVD, CISA).
  - **Tier 4 (Threat Intel)**: Commercial security feeds (VirusTotal, AbuseIPDB, AlienVault OTX).
  - **Tier 3 (Established)**: Public registries, DNS, certificate logs (crt.sh, OpenCorporates).
  - **Tier 2 (Community)**: Aggregators, forums, web archives (Reddit, HackerNews, Wayback).
  - **Tier 1 (Unverified)**: Raw search results and user submissions.
- **Tradeoffs & Alternatives**:
  - *Alternative Considered*: Treating all sources with equal weight.
  - *Why Rejected*: Misleading confidence calculations when community sources contradicted official government records.
