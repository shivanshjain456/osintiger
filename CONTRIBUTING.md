# Contributing to OSINTiger

Thank you for your interest in contributing to OSINTiger. We welcome contributions that improve intelligence quality, add verified public collectors, enhance attribution checking, and strengthen platform security.

---

## Development Environment Setup

### Prerequisites
- Node.js 20.x, 21.x, or 22.x
- npm 10.x or higher (or bun 1.1+)
- Git

### Initializing the Workspace
```bash
# Clone the repository
git clone https://github.com/shivanshjain456/osintiger.git
cd osintiger

# Install dependencies
npm install

# Initialize local database schema
npx prisma generate
npx prisma db push

# Seed synthetic demonstration data
npm run seed:demo

# Start the development server
npm run dev
```

---

## Engineering Guidelines

### 1. Adding a New OSINT Collector
When adding a new intelligence collector:
1. Implement the collector under `src/lib/osint/sources/`.
2. Ensure the collector gracefully handles timeouts (default 10s timeout) and rate limits.
3. Classify the source into the appropriate reliability tier in `src/lib/osint/confidence-engine.ts`:
   - Tier 5: Authoritative standards / government bodies
   - Tier 4: Commercial threat intelligence platforms
   - Tier 3: Established registries and public DNS providers
   - Tier 2: Community aggregators
   - Tier 1: Raw search engines / user submissions
4. Register the source in `src/lib/osint/router.ts`.
5. Every extracted finding must format its claim with an explicit citation:
   `"[SOURCE: <SourceLabel>, URL: <CanonicalURL>]"`.
6. Add unit tests with mock fixture data under `src/lib/osint/__tests__/`.

### 2. Testing Discipline
- All unit and integration tests must run offline without requiring external network connectivity or paid API credentials.
- Mock all outbound HTTP requests using Vitest mocks or fixture payloads.
- Run the full test suite before committing:
  ```bash
  npm test
  ```
- Run static linting to ensure compliance:
  ```bash
  npm run lint
  ```

### 3. Credential and Key Handling
- Never hardcode API keys, personal emails, or private infrastructure URLs in code or fixtures.
- All secrets must use environment variable fallbacks or synthetic placeholders (`sk_test_placeholder`).
- Never commit `.env` or `.env.local` files.

---

## Pull Request Process

1. Fork the repository and create a feature branch (`git checkout -b feat/new-dns-collector`).
2. Implement your changes following established TypeScript patterns.
3. Verify that all tests pass (`npm test`) and code builds cleanly (`npm run build`).
4. Commit your changes with clear, semantic commit messages (`feat(collector): add crtsh SAN parser`).
5. Open a Pull Request with a clear description of changes and testing proof.
