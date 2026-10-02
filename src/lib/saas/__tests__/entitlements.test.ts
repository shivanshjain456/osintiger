// Tests for the entitlements module — the core SaaS enforcement layer.
// These tests verify plan limit checks, feature gates, export gates, and mode gates.
// The entitlements module is the highest-risk area: bugs here cause revenue loss
// (allowing free users to access premium features) or user frustration
// (blocking paid users from features they paid for).

import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the pure functions that don't require DB access.
// The DB-dependent functions (resolveEntitlement, consumeAICredits, etc.)
// are tested via integration tests.
import {
  checkModeEntitlement,
  checkExportEntitlement,
  checkFeatureEntitlement,
  ANONYMOUS_ENTITLEMENT,
  type ResolvedSubscription,
} from "../entitlements";
import { PLAN_DEFINITIONS, type PlanLimits } from "../plans";

// Build test entitlements for each tier
function makeEnt(tier: string, limits: PlanLimits): ResolvedSubscription {
  return {
    subscription: { id: "test-sub", status: "active", billingCycle: "monthly", tier: tier as never, planId: "test", currentPeriodEnd: null, cancelAtPeriodEnd: false },
    planLimits: limits,
    tier: tier as never,
    userId: "test-user",
    organizationId: null,
  };
}

const freeEnt = makeEnt("free", PLAN_DEFINITIONS[0].limits);
const investigatorEnt = makeEnt("investigator", PLAN_DEFINITIONS[1].limits);
const professionalEnt = makeEnt("professional", PLAN_DEFINITIONS[2].limits);
const teamEnt = makeEnt("team", PLAN_DEFINITIONS[3].limits);
const enterpriseEnt = makeEnt("enterprise", PLAN_DEFINITIONS[4].limits);

describe("Entitlements", () => {
  describe("ANONYMOUS_ENTITLEMENT", () => {
    it("should have null subscription", () => {
      expect(ANONYMOUS_ENTITLEMENT.subscription).toBeNull();
    });

    it("should have free tier", () => {
      expect(ANONYMOUS_ENTITLEMENT.tier).toBe("free");
    });

    it("should have null userId", () => {
      expect(ANONYMOUS_ENTITLEMENT.userId).toBeNull();
    });

    it("should have 1 investigation per month", () => {
      expect(ANONYMOUS_ENTITLEMENT.planLimits.investigationsPerMonth).toBe(1);
    });

    it("should have 3 AI credits per month", () => {
      expect(ANONYMOUS_ENTITLEMENT.planLimits.aiCreditsPerMonth).toBe(3);
    });

    it("should only allow standard mode", () => {
      expect(ANONYMOUS_ENTITLEMENT.planLimits.modes).toEqual(["standard"]);
    });

    it("should have no exports", () => {
      expect(ANONYMOUS_ENTITLEMENT.planLimits.exports).toHaveLength(0);
    });
  });

  describe("checkModeEntitlement", () => {
    it("should allow standard mode on free tier", () => {
      const result = checkModeEntitlement(freeEnt, "standard");
      expect(result.allowed).toBe(true);
    });

    it("should deny agent mode on free tier", () => {
      const result = checkModeEntitlement(freeEnt, "agent");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("agent");
      expect(result.upgradeTier).toBe("investigator");
    });

    it("should deny discovery mode on free tier", () => {
      const result = checkModeEntitlement(freeEnt, "discovery");
      expect(result.allowed).toBe(false);
      expect(result.upgradeTier).toBe("investigator");
    });

    it("should deny plan mode on free tier", () => {
      const result = checkModeEntitlement(freeEnt, "plan");
      expect(result.allowed).toBe(false);
      expect(result.upgradeTier).toBe("investigator");
    });

    it("should deny monitor mode on free tier", () => {
      const result = checkModeEntitlement(freeEnt, "monitor");
      expect(result.allowed).toBe(false);
      expect(result.upgradeTier).toBe("investigator");
    });

    it("should allow all 5 modes on Investigator", () => {
      for (const mode of ["standard", "agent", "discovery", "plan", "monitor"]) {
        const result = checkModeEntitlement(investigatorEnt, mode);
        expect(result.allowed).toBe(true);
      }
    });

    it("should allow all 5 modes on Professional", () => {
      for (const mode of ["standard", "agent", "discovery", "plan", "monitor"]) {
        const result = checkModeEntitlement(professionalEnt, mode);
        expect(result.allowed).toBe(true);
      }
    });

    it("should allow all 5 modes on Team", () => {
      for (const mode of ["standard", "agent", "discovery", "plan", "monitor"]) {
        const result = checkModeEntitlement(teamEnt, mode);
        expect(result.allowed).toBe(true);
      }
    });

    it("should allow all 5 modes on Enterprise", () => {
      for (const mode of ["standard", "agent", "discovery", "plan", "monitor"]) {
        const result = checkModeEntitlement(enterpriseEnt, mode);
        expect(result.allowed).toBe(true);
      }
    });

    it("should deny unknown mode", () => {
      const result = checkModeEntitlement(investigatorEnt, "unknown_mode");
      expect(result.allowed).toBe(false);
    });
  });

  describe("checkExportEntitlement", () => {
    it("should deny all exports on free tier", () => {
      for (const format of ["markdown", "json", "pdf", "csv", "stix"]) {
        const result = checkExportEntitlement(freeEnt, format);
        expect(result.allowed).toBe(false);
      }
    });

    it("should allow markdown on Investigator", () => {
      expect(checkExportEntitlement(investigatorEnt, "markdown").allowed).toBe(true);
    });

    it("should allow json on Investigator", () => {
      expect(checkExportEntitlement(investigatorEnt, "json").allowed).toBe(true);
    });

    it("should deny pdf on Investigator", () => {
      const result = checkExportEntitlement(investigatorEnt, "pdf");
      expect(result.allowed).toBe(false);
      expect(result.upgradeTier).toBe("professional");
    });

    it("should deny csv on Investigator", () => {
      const result = checkExportEntitlement(investigatorEnt, "csv");
      expect(result.allowed).toBe(false);
      expect(result.upgradeTier).toBe("professional");
    });

    it("should deny stix on Investigator", () => {
      const result = checkExportEntitlement(investigatorEnt, "stix");
      expect(result.allowed).toBe(false);
      expect(result.upgradeTier).toBe("professional");
    });

    it("should allow all formats on Professional", () => {
      for (const format of ["markdown", "json", "pdf", "csv", "stix"]) {
        expect(checkExportEntitlement(professionalEnt, format).allowed).toBe(true);
      }
    });

    it("should allow all formats on Team", () => {
      for (const format of ["markdown", "json", "pdf", "csv", "stix"]) {
        expect(checkExportEntitlement(teamEnt, format).allowed).toBe(true);
      }
    });

    it("should allow all formats on Enterprise", () => {
      for (const format of ["markdown", "json", "pdf", "csv", "stix"]) {
        expect(checkExportEntitlement(enterpriseEnt, format).allowed).toBe(true);
      }
    });
  });

  describe("checkFeatureEntitlement", () => {
    it("should deny apiAccess on free tier", () => {
      const result = checkFeatureEntitlement(freeEnt, "apiAccess");
      expect(result.allowed).toBe(false);
    });

    it("should deny apiAccess on Investigator", () => {
      const result = checkFeatureEntitlement(investigatorEnt, "apiAccess");
      expect(result.allowed).toBe(false);
    });

    it("should allow apiAccess on Professional", () => {
      const result = checkFeatureEntitlement(professionalEnt, "apiAccess");
      expect(result.allowed).toBe(true);
    });

    it("should deny multiAgentDebate on free tier", () => {
      const result = checkFeatureEntitlement(freeEnt, "multiAgentDebate");
      expect(result.allowed).toBe(false);
    });

    it("should allow multiAgentDebate on Investigator", () => {
      const result = checkFeatureEntitlement(investigatorEnt, "multiAgentDebate");
      expect(result.allowed).toBe(true);
    });

    it("should deny visualIntelligence on free tier", () => {
      const result = checkFeatureEntitlement(freeEnt, "visualIntelligence");
      expect(result.allowed).toBe(false);
    });

    it("should allow visualIntelligence on Investigator", () => {
      const result = checkFeatureEntitlement(investigatorEnt, "visualIntelligence");
      expect(result.allowed).toBe(true);
    });

    it("should deny ssoEnabled on Team", () => {
      const result = checkFeatureEntitlement(teamEnt, "ssoEnabled");
      expect(result.allowed).toBe(false);
    });

    it("should allow ssoEnabled on Enterprise", () => {
      const result = checkFeatureEntitlement(enterpriseEnt, "ssoEnabled");
      expect(result.allowed).toBe(true);
    });

    it("should deny whiteLabelReports on Professional", () => {
      const result = checkFeatureEntitlement(professionalEnt, "whiteLabelReports");
      expect(result.allowed).toBe(false);
    });

    it("should allow whiteLabelReports on Team", () => {
      const result = checkFeatureEntitlement(teamEnt, "whiteLabelReports");
      expect(result.allowed).toBe(true);
    });

    it("should deny automationEnabled on Investigator", () => {
      const result = checkFeatureEntitlement(investigatorEnt, "automationEnabled");
      expect(result.allowed).toBe(false);
    });

    it("should allow automationEnabled on Professional", () => {
      const result = checkFeatureEntitlement(professionalEnt, "automationEnabled");
      expect(result.allowed).toBe(true);
    });

    it("should allow batchSanctions on all tiers", () => {
      for (const ent of [freeEnt, investigatorEnt, professionalEnt, teamEnt, enterpriseEnt]) {
        const result = checkFeatureEntitlement(ent, "batchSanctions");
        expect(result.allowed).toBe(true);
      }
    });

    it("should deny customSources on Team", () => {
      const result = checkFeatureEntitlement(teamEnt, "customSources");
      expect(result.allowed).toBe(false);
    });

    it("should allow customSources on Enterprise", () => {
      const result = checkFeatureEntitlement(enterpriseEnt, "customSources");
      expect(result.allowed).toBe(true);
    });

    it("should deny dedicatedCsm on Team", () => {
      const result = checkFeatureEntitlement(teamEnt, "dedicatedCsm");
      expect(result.allowed).toBe(false);
    });

    it("should allow dedicatedCsm on Enterprise", () => {
      const result = checkFeatureEntitlement(enterpriseEnt, "dedicatedCsm");
      expect(result.allowed).toBe(true);
    });

    it("should deny prioritySupport on Investigator", () => {
      const result = checkFeatureEntitlement(investigatorEnt, "prioritySupport");
      expect(result.allowed).toBe(false);
    });

    it("should allow prioritySupport on Professional", () => {
      const result = checkFeatureEntitlement(professionalEnt, "prioritySupport");
      expect(result.allowed).toBe(true);
    });

    it("should handle numeric features (monitoringTargets=0 → denied)", () => {
      const result = checkFeatureEntitlement(freeEnt, "monitoringTargets");
      expect(result.allowed).toBe(false);
    });

    it("should handle numeric features (monitoringTargets>0 → allowed)", () => {
      const result = checkFeatureEntitlement(investigatorEnt, "monitoringTargets");
      expect(result.allowed).toBe(true);
    });

    it("should handle numeric features (-1 unlimited → allowed)", () => {
      const result = checkFeatureEntitlement(enterpriseEnt, "monitoringTargets");
      expect(result.allowed).toBe(true);
    });
  });
});
