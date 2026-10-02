# Security Architecture & Cryptographic Controls

> Detailed analysis of threat boundaries, cryptographic primitives, and data isolation policies in OSINTiger.

---

## 1. Cryptographic Controls and Key Management

### 1.1 BYO-LLM Credential Storage
To allow users to leverage external LLM models (OpenAI, Anthropic) without exposing credentials, keys are encrypted prior to database insertion:

- **Algorithm**: Advanced Encryption Standard in Galois/Counter Mode (**AES-256-GCM**).
- **Key Derivation**: `scryptSync` with an application-specific salt and 32-byte key length.
- **Initialization Vector**: A cryptographically secure 16-byte random IV (`crypto.randomBytes(16)`) is generated uniquely for every encryption operation.
- **Authentication Tag**: A 16-byte GCM authentication tag guarantees ciphertext integrity and prevents bit-flipping attacks.
- **Serialization**: Persisted as a colon-delimited string `iv:tag:ciphertext` in hex format.
- **Lifecycle**: Decryption is performed in volatile server memory strictly during outbound HTTP requests to the provider API. Plaintext keys are never logged, never returned to client endpoints, and never stored in temporary swap buffers.

### 1.2 Evidence Provenance Hashing
- Every raw response payload received from public OSINT telemetry is hashed using **SHA-256** upon ingestion.
- The resulting hex digest is recorded in the immutable `ProvenanceEvent` table.
- This cryptographic record allows verification that raw evidence was not retroactively altered during AI synthesis or manual review.

---

## 2. Network Boundary Defense & SSRF Prevention

Because OSINT platforms query external network targets, outbound request dispatch is governed by strict network egress rules:

- **Prohibition of Private Address Ranges**: Outbound collectors reject queries resolving to private IPv4 ranges (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback interfaces (`127.0.0.0/8`), link-local addresses (`169.254.0.0/16`), and private IPv6 ranges (`::1`, `fc00::/7`).
- **Cloud Metadata Block**: Prohibits requests targeting cloud instance metadata services (e.g., `http://169.254.169.254/latest/meta-data/`).
- **Timeout Isolation**: Every external collector request operates with an explicit 10-second timeout guardrail to prevent resource exhaustion attacks.

---

## 3. Data Sanitization & Information Leakage Protection

- **Production Error Scrubbing (`src/lib/osint/safe-error.ts`)**: In production environments, all unhandled route errors return sanitized generic responses. Internal database connection strings, database usernames, server file paths, and stack traces are completely excluded.
- **Input Validation**: Strict type-checking and length limits prevent buffer overruns or malformed query payloads from reaching downstream collectors.

---

## 4. Ethical Boundaries & Acceptable Use Policy

OSINTiger is designed exclusively for defensive cybersecurity, compliance verification, and academic research:

1. **Authorized Scope**: Users must only assess assets they own, manage, or have formal written consent to analyze.
2. **Anti-Harassment Standards**: The software prohibits workflows targeted at harassment, personal doxxing, non-consensual tracking, or unlawful surveillance.
3. **Terms of Service Compliance**: Users are responsible for adhering to the query terms, rate limits, and API agreements of all queried third-party providers.
