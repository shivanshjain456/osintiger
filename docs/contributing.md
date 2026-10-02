# Contributing

## Development Setup

See [Setup Guide](setup.md) for detailed installation instructions.

```bash
git clone <repository-url>
cd osintiger
bun install
cp .env.example .env
# Edit .env with your credentials
bun run db:push
bun run seed:plans
bun run dev
```

## Branch Strategy

```
main          — Production-ready code
feature/*     — New features
bugfix/*      — Bug fixes
hotfix/*      — Emergency production fixes
```

## Commit Convention

Use [Conventional Commits](https://conventionalcommits.org/):

```
feat: add crypto wallet risk scoring
fix: prevent duplicate webhook processing
docs: update API reference
refactor: extract entitlements to service layer
test: add data integrity tests
security: fix auth bypass on collections API
perf: add lightweight metadata query for /api/recent
```

## Pull Request Requirements

- [ ] Tests pass: `bun run test`
- [ ] Lint passes: `bun run lint`
- [ ] TypeScript passes: `npx tsc --noEmit`
- [ ] No new dependencies without justification
- [ ] Documentation updated if needed
- [ ] No secrets or credentials in code

## Code Review Guidelines

### Correctness
- Does the code do what it claims?
- Are edge cases handled?
- Are error paths tested?

### Security
- Are all new API routes wrapped with `apiHandler`?
- Are auth checks present on mutation endpoints?
- Is user input validated?
- Are secrets handled via `process.env` only?

### Performance
- Are DB queries using `select` projections?
- Are multiple independent queries in `Promise.all`?
- Are there N+1 query patterns?

### Maintainability
- Does the code follow existing patterns?
- Are design tokens used (not Tailwind color classes)?
- Is the file size reasonable (<500 lines)?

## Coding Standards

### Design Tokens
Always use CSS custom properties, never Tailwind color classes:
```tsx
// ✅ Good
className="text-[var(--hack-green)]"

// ❌ Bad
className="text-green-400"
```

### Error Handling
Always use the standardized helpers:
```tsx
// ✅ Good
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";
export const GET = apiGet(async (_req, { params }) => {
  const rec = await getRecord(params.id);
  if (!rec) return notFoundResponse("investigation");
  return NextResponse.json(rec);
});

// ❌ Bad
export async function GET(req, { params }) {
  const rec = await getRecord(params.id);
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(rec);
}
```

### Database Access
Use transactions for multi-step operations:
```tsx
// ✅ Good
await db.$transaction([
  db.collectionItem.deleteMany({ where: { collectionId: id } }),
  db.collection.delete({ where: { id } }),
]);

// ❌ Bad
await db.collectionItem.deleteMany({ where: { collectionId: id } });
await db.collection.delete({ where: { id } });
```

### Testing
Write meaningful tests, not coverage-fillers:
```tsx
// ✅ Good
it("should deny agent mode on free tier", () => {
  const result = checkModeEntitlement(freeEnt, "agent");
  expect(result.allowed).toBe(false);
  expect(result.upgradeTier).toBe("investigator");
});

// ❌ Bad
it("should work", () => {
  expect(true).toBe(true);
});
```
