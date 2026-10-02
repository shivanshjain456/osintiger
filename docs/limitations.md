# System Limitations & Engineering Boundaries

> Honest documentation of technical constraints, scaling boundaries, and non-guarantees in OSINTiger.

---

## 1. Upstream Public Telemetry Constraints

1. **Third-Party Rate Limits**:
   - OSINTiger queries public unauthenticated endpoints (e.g., `crt.sh`, SEC EDGAR, DuckDuckGo, ip-api.com).
   - High-frequency sequential scans against the same target or rapid parallel scans may encounter HTTP 429 (Too Many Requests) or temporary IP throttling from upstream providers.
   - *Mitigation*: Upstream queries use exponential backoff, per-source rate-limit policies, and graceful fallback to cached results where available.

2. **OFAC Sanctions Dataset Scope**:
   - The embedded sanctions screening module uses a curated subset of the US Treasury OFAC Specially Designated Nationals (SDN) roster with Levenshtein fuzzy name matching.
   - It is designed for preliminary indicator triage, not certified banking-grade AML/KYC compliance.
   - *Recommendation*: Financial institutions should integrate direct live feeds from commercial sanction providers (e.g., Refinitiv World-Check, Dow Jones).

---

## 2. Infrastructure & Scalability Ceilings

1. **Single-Node SQLite Persistence**:
   - The default configuration uses local SQLite persistence.
   - While SQLite supports high-concurrency reads in WAL mode, writes are serialized. Workloads exceeding 100 concurrent write-intensive scans per minute should migrate to PostgreSQL by updating Prisma's datasource configuration.

2. **In-Memory Job State**:
   - Real-time investigation progress is tracked via an in-memory `Map` with database synchronization at milestone steps.
   - A hard crash or server restart during an in-flight scan will mark the investigation as interrupted. The client must re-initiate or poll the database for the last persisted step.

---

## 3. Analytical & Cognitive Model Boundaries

1. **LLM Synthesis Latency**:
   - Generative synthesis, hypothesis testing, and multi-agent debate require 3 to 10 seconds per investigation depending on provider responsiveness (OpenAI vs Anthropic vs local fallback).
   - All AI calls are bounded by a strict 60-second timeout.

2. **Visual Geolocation Boundaries**:
   - Visual intelligence and image geolocation rely on EXIF metadata (when preserved) and landmark/signage recognition via Vision-Language Models (VLM).
   - Visual analysis provides probabilistic regions or landmarks; it cannot guarantee exact GPS coordinates for images lacking clear geographic reference points.

3. **Zero-Hallucination Guardrails**:
   - While the platform programmatically flags unsourced statements via regex attribution checks, human analysts must review flagged findings before drawing high-stakes operational conclusions.
