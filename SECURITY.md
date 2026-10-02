# Security Policy and Responsible Use Boundaries

## Scope and Principles

OSINTiger is an open-source intelligence analysis and threat-research platform designed for defensive security teams, compliance officers, and academic researchers. Because intelligence gathering operates on sensitive external telemetry, the application is engineered under strict security, privacy, and isolation guarantees.

---

## Threat Model and Security Architecture

| Security Domain | Threat Vector | Engineering Mitigation |
|---|---|---|
| **BYO API Key Storage** | Credential theft via SQLite file access or database dumps | All user-supplied API keys (OpenAI, Anthropic, VirusTotal, AbuseIPDB) are encrypted at rest using **AES-256-GCM** with a unique 16-byte initialization vector (IV) per entry and scrypt key derivation. Keys are decrypted strictly in-memory during external API requests and are scrubbed from serialized responses and logs. |
| **Data Leakage & Logging** | Accidental leakage of database credentials or internal infrastructure | Custom `safeErrorResponse` utility catches all unhandled exceptions. In production, generic client errors are returned (HTTP 500) while internal connection strings (`postgres://...`, file paths) are completely stripped. |
| **Hallucination Prevention** | Generative models inventing non-existent threat intelligence | Zero-hallucination citation protocol: every extracted claim is validated against raw source payloads. Claims lacking an explicit `[SOURCE: <name>, URL: <url>]` citation trigger an immediate `attribution_valid: false` flag and require human review. |
| **SSRF & Network Abuse** | Target queries pivoting into private cloud metadata or loopback endpoints | Outbound HTTP requests from intelligence collectors reject internal IP ranges (RFC 1918 private subnets: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, and AWS/GCP metadata endpoints `169.254.169.254`). |
| **Authentication & RBAC** | Unauthorized access to stored investigation records | Session verification via Supabase SSR / JWT auth with tenant-scoped database isolation. Investigations are indexed and accessible strictly by the owning account. |
| **Client Script Injection** | Malicious payloads in DNS records, WHOIS banners, or certificate SANs | Strict React DOM escaping on all external data renderers, combined with Content Security Policy headers preventing execution of unauthorized inline scripts. |

---

## Acceptable Use and Ethical Boundaries

OSINTiger is published under the condition that it is used ethically, responsibly, and in full compliance with all relevant laws:

1. **Defensive and Authorized Operations**: Only query infrastructure, domains, and entities that you own, operate, or have explicit legal authorization to evaluate.
2. **Prohibition of Harassment and Doxxing**: The software must never be used for unlawful stalking, harassment, personal intimidation, doxxing, or mass surveillance of private individuals.
3. **Compliance with Provider Terms**: Respect rate limits, terms of service, and robots.txt policies of all upstream data providers (e.g., crt.sh, SEC EDGAR, ICIJ).
4. **Data Privacy Regulations**: When processing data that may contain personal information, ensure compliance with GDPR, CCPA, and applicable local privacy frameworks.

---

## Reporting a Security Vulnerability

If you discover a security vulnerability or credential exposure risk within OSINTiger:

1. **Do not open a public issue.**
2. Email a detailed vulnerability report to `security@osintiger.dev` (or the repository maintainer directly via GitHub Security Advisories).
3. Include:
   - Type of vulnerability (e.g., SSRF, bypass of encryption, authentication flaw).
   - Step-by-step reproduction instructions or proof-of-concept payload.
   - Potential impact and affected components.
4. Maintainers will acknowledge receipt within 48 hours and work with you on coordinated disclosure.
