// Tests for the SaaS plan catalog — the commercial pricing configuration.
// These tests verify that the plan definitions are internally consistent,
// correctly ordered, and that limits are sensible (e.g., higher tiers have
// >= limits than lower tiers, free tier is restricted, enterprise is unlimited).

import { describe, it, expect } from "vitest";
import {
  PLAN_DEFINITIONS,
  AI_CREDIT_COSTS,
  CREDIT_PACKS,
  formatPrice,
  getPlanDefinition,
  isUnlimited,
  type PlanTier,
} from "../plans";

describe("Plan Catalog", () => {
  describe("PLAN_DEFINITIONS", () => {
    it("should have exactly 5 tiers", () => {
      expect(PLAN_DEFINITIONS).toHaveLength(5);
    });

    it("should have tiers in correct order", () => {
      const tiers = PLAN_DEFINITIONS.map((p) => p.tier);
      expect(tiers).toEqual(["free", "investigator", "professional", "team", "enterprise"]);
    });

    it("should have ascending sort orders", () => {
      const orders = PLAN_DEFINITIONS.map((p) => p.sortOrder);
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });

    it("should have the Investigator plan as featured", () => {
      const investigator = getPlanDefinition("investigator");
      expect(investigator?.isFeatured).toBe(true);
    });

    it("should have only one featured plan", () => {
      const featured = PLAN_DEFINITIONS.filter((p) => p.isFeatured);
      expect(featured).toHaveLength(1);
      expect(featured[0].tier).toBe("investigator");
    });

    it("should have the free plan priced at $0", () => {
      const free = getPlanDefinition("free");
      expect(free?.priceMonthly).toBe(0);
      expect(free?.priceAnnual).toBe(0);
    });

    it("should have enterprise priced at $0 (custom)", () => {
      const enterprise = getPlanDefinition("enterprise");
      expect(enterprise?.priceMonthly).toBe(0);
      expect(enterprise?.priceAnnual).toBe(0);
    });

    it("should have annual price less than 12x monthly for paid plans (discount)", () => {
      for (const plan of PLAN_DEFINITIONS) {
        if (plan.priceMonthly > 0) {
          const annualPerMonth = plan.priceAnnual / 12;
          expect(annualPerMonth).toBeLessThan(plan.priceMonthly);
        }
      }
    });

    it("should have each plan with at least 3 marketing features", () => {
      for (const plan of PLAN_DEFINITIONS) {
        expect(plan.marketing.features.length).toBeGreaterThanOrEqual(3);
      }
    });

    it("should have each plan with at least 1 highlight", () => {
      for (const plan of PLAN_DEFINITIONS) {
        expect(plan.marketing.highlight.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("Plan Limits Hierarchy", () => {
    it("should have increasing investigation limits from free to team", () => {
      const free = getPlanDefinition("free")!;
      const investigator = getPlanDefinition("investigator")!;
      const professional = getPlanDefinition("professional")!;
      const team = getPlanDefinition("team")!;

      expect(free.limits.investigationsPerMonth).toBeLessThan(investigator.limits.investigationsPerMonth);
      expect(investigator.limits.investigationsPerMonth).toBeLessThan(professional.limits.investigationsPerMonth);
      expect(professional.limits.investigationsPerMonth).toBeLessThan(team.limits.investigationsPerMonth);
    });

    it("should have increasing AI credit limits from free to team", () => {
      const free = getPlanDefinition("free")!;
      const investigator = getPlanDefinition("investigator")!;
      const professional = getPlanDefinition("professional")!;
      const team = getPlanDefinition("team")!;

      expect(free.limits.aiCreditsPerMonth).toBeLessThan(investigator.limits.aiCreditsPerMonth);
      expect(investigator.limits.aiCreditsPerMonth).toBeLessThan(professional.limits.aiCreditsPerMonth);
      expect(professional.limits.aiCreditsPerMonth).toBeLessThan(team.limits.aiCreditsPerMonth);
    });

    it("should have enterprise with unlimited investigations", () => {
      const enterprise = getPlanDefinition("enterprise")!;
      expect(isUnlimited(enterprise.limits.investigationsPerMonth)).toBe(true);
    });

    it("should have enterprise with unlimited retention", () => {
      const enterprise = getPlanDefinition("enterprise")!;
      expect(isUnlimited(enterprise.limits.retentionDays)).toBe(true);
    });

    it("should restrict free tier to standard mode only", () => {
      const free = getPlanDefinition("free")!;
      expect(free.limits.modes).toEqual(["standard"]);
    });

    it("should allow all 5 modes on Investigator and above", () => {
      const tiers: PlanTier[] = ["investigator", "professional", "team", "enterprise"];
      for (const tier of tiers) {
        const plan = getPlanDefinition(tier)!;
        expect(plan.limits.modes).toEqual(["standard", "agent", "discovery", "plan", "monitor"]);
      }
    });

    it("should have no exports on free tier", () => {
      const free = getPlanDefinition("free")!;
      expect(free.limits.exports).toHaveLength(0);
    });

    it("should have markdown+json on Investigator+", () => {
      for (const tier of ["investigator", "professional", "team", "enterprise"] as PlanTier[]) {
        const plan = getPlanDefinition(tier)!;
        expect(plan.limits.exports).toContain("markdown");
        expect(plan.limits.exports).toContain("json");
      }
    });

    it("should have PDF, CSV, STIX on Professional+", () => {
      for (const tier of ["professional", "team", "enterprise"] as PlanTier[]) {
        const plan = getPlanDefinition(tier)!;
        expect(plan.limits.exports).toContain("pdf");
        expect(plan.limits.exports).toContain("csv");
        expect(plan.limits.exports).toContain("stix");
      }
    });

    it("should have API access only on Professional+", () => {
      expect(getPlanDefinition("free")!.limits.apiAccess).toBe(false);
      expect(getPlanDefinition("investigator")!.limits.apiAccess).toBe(false);
      expect(getPlanDefinition("professional")!.limits.apiAccess).toBe(true);
      expect(getPlanDefinition("team")!.limits.apiAccess).toBe(true);
      expect(getPlanDefinition("enterprise")!.limits.apiAccess).toBe(true);
    });

    it("should have SSO only on Enterprise", () => {
      expect(getPlanDefinition("enterprise")!.limits.ssoEnabled).toBe(true);
      for (const tier of ["free", "investigator", "professional", "team"] as PlanTier[]) {
        expect(getPlanDefinition(tier)!.limits.ssoEnabled).toBe(false);
      }
    });

    it("should have no monitoring targets on free", () => {
      expect(getPlanDefinition("free")!.limits.monitoringTargets).toBe(0);
    });

    it("should have no agent iterations on free", () => {
      expect(getPlanDefinition("free")!.limits.maxAgentIterations).toBe(0);
    });

    it("should not allow multi-agent debate on free", () => {
      expect(getPlanDefinition("free")!.limits.multiAgentDebate).toBe(false);
    });

    it("should not allow visual intelligence on free", () => {
      expect(getPlanDefinition("free")!.limits.visualIntelligence).toBe(false);
    });

    it("should allow batch sanctions on all tiers", () => {
      for (const plan of PLAN_DEFINITIONS) {
        expect(plan.limits.batchSanctions).toBe(true);
      }
    });
  });

  describe("AI Credit Costs", () => {
    it("should have costs for all 10 operations", () => {
      expect(Object.keys(AI_CREDIT_COSTS)).toHaveLength(10);
    });

    it("should have all costs be positive integers", () => {
      for (const [op, cost] of Object.entries(AI_CREDIT_COSTS)) {
        expect(cost).toBeGreaterThan(0);
        expect(Number.isInteger(cost)).toBe(true);
      }
    });

    it("should have multi-agent debate as the most expensive operation", () => {
      const debateCost = AI_CREDIT_COSTS.multi_agent_debate;
      for (const [op, cost] of Object.entries(AI_CREDIT_COSTS)) {
        if (op !== "multi_agent_debate") {
          expect(cost).toBeLessThan(debateCost);
        }
      }
    });

    it("should have ai_qa as the cheapest operation", () => {
      const qaCost = AI_CREDIT_COSTS.ai_qa;
      for (const [op, cost] of Object.entries(AI_CREDIT_COSTS)) {
        if (op !== "ai_qa") {
          expect(cost).toBeGreaterThanOrEqual(qaCost);
        }
      }
    });

    it("should have VLM analysis cost > synthesis cost", () => {
      expect(AI_CREDIT_COSTS.vlm_analysis).toBeGreaterThan(AI_CREDIT_COSTS.synthesis);
    });

    it("should have free tier credits sufficient for at least 1 synthesis", () => {
      const freeCredits = getPlanDefinition("free")!.limits.aiCreditsPerMonth;
      expect(freeCredits).toBeGreaterThanOrEqual(AI_CREDIT_COSTS.synthesis);
    });
  });

  describe("Credit Packs", () => {
    it("should have at least 3 packs", () => {
      expect(CREDIT_PACKS.length).toBeGreaterThanOrEqual(3);
    });

    it("should have exactly one popular pack", () => {
      const popular = CREDIT_PACKS.filter((p) => p.popular);
      expect(popular).toHaveLength(1);
    });

    it("should have increasing credit amounts", () => {
      for (let i = 1; i < CREDIT_PACKS.length; i++) {
        expect(CREDIT_PACKS[i].credits).toBeGreaterThan(CREDIT_PACKS[i - 1].credits);
      }
    });

    it("should have decreasing per-credit price (bulk discount)", () => {
      for (let i = 1; i < CREDIT_PACKS.length; i++) {
        const prevPerCredit = CREDIT_PACKS[i - 1].priceCents / CREDIT_PACKS[i - 1].credits;
        const currPerCredit = CREDIT_PACKS[i].priceCents / CREDIT_PACKS[i].credits;
        expect(currPerCredit).toBeLessThanOrEqual(prevPerCredit);
      }
    });

    it("should have unique ids", () => {
      const ids = CREDIT_PACKS.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("formatPrice", () => {
    it("should format $0 as 'Custom'", () => {
      expect(formatPrice(0)).toBe("Custom");
    });

    it("should format 4900 cents as '$49/mo'", () => {
      expect(formatPrice(4900)).toBe("$49/mo");
    });

    it("should format 49000 cents as '$490/yr' with annual cycle", () => {
      expect(formatPrice(49000, "annual")).toBe("$490/yr");
    });

    it("should format 1500 cents as '$15/mo'", () => {
      expect(formatPrice(1500)).toBe("$15/mo");
    });
  });

  describe("getPlanDefinition", () => {
    it("should return the plan for a valid tier", () => {
      const plan = getPlanDefinition("investigator");
      expect(plan).toBeDefined();
      expect(plan?.tier).toBe("investigator");
    });

    it("should return undefined for an invalid tier", () => {
      const plan = getPlanDefinition("nonexistent" as PlanTier);
      expect(plan).toBeUndefined();
    });
  });

  describe("isUnlimited", () => {
    it("should return true for -1", () => {
      expect(isUnlimited(-1)).toBe(true);
    });

    it("should return false for 0", () => {
      expect(isUnlimited(0)).toBe(false);
    });

    it("should return false for positive numbers", () => {
      expect(isUnlimited(100)).toBe(false);
    });
  });
});
