// Seed subscription plans into the database.
// Run with: bun run seed:plans

import { db } from "../src/lib/db";
import { seedAllPlans } from "../src/lib/saas/entitlements";

async function main() {
  console.log("Seeding subscription plans...");
  await seedAllPlans();
  const count = await db.subscriptionPlan.count();
  console.log(`✓ Seeded ${count} plans successfully.`);
  const plans = await db.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } });
  for (const p of plans) {
    console.log(`  ${p.tier}: ${p.name} — $${(p.priceMonthly / 100).toFixed(2)}/mo`);
  }
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
