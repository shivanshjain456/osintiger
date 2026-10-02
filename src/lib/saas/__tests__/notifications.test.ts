// Tests for the notifications module — user-facing alert creation.
// Bugs here would cause notifications to be missing or malformed.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock at the module level — vi.hoisted ensures the mock is available
// before the notifications module is imported.
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: data.id,
    ...data,
  })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    notification: {
      create: mockCreate,
    },
  },
}));

import { createNotification } from "../notifications";

describe("Notifications", () => {
  beforeEach(() => {
    mockCreate.mockClear();
  });

  describe("createNotification", () => {
    it("should create a notification with all fields", async () => {
      await createNotification({
        userId: "user-123",
        type: "investigation.complete",
        title: "Investigation complete: example.com",
        body: "Your investigation has completed successfully.",
        severity: "success",
        category: "investigation",
        resourceType: "investigation",
        resourceId: "inv-456",
        routeName: "investigation-report",
        routeParams: { id: "inv-456" },
      });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "investigation.complete",
            title: "Investigation complete: example.com",
            body: "Your investigation has completed successfully.",
            severity: "success",
            category: "investigation",
            resourceType: "investigation",
            resourceId: "inv-456",
            routeName: "investigation-report",
            routeParamsJson: JSON.stringify({ id: "inv-456" }),
          }),
        })
      );
    });

    it("should not call db.create when userId is null (anonymous)", async () => {
      await createNotification({
        userId: null,
        type: "investigation.complete",
        title: "Test",
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should not call db.create when userId is undefined", async () => {
      await createNotification({
        userId: undefined,
        type: "investigation.complete",
        title: "Test",
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should use default severity of info when not provided", async () => {
      await createNotification({
        userId: "user-123",
        type: "system.maintenance",
        title: "Maintenance window",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            severity: "info",
          }),
        })
      );
    });

    it("should use default category of general when not provided", async () => {
      await createNotification({
        userId: "user-123",
        type: "system.maintenance",
        title: "Maintenance",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: "general",
          }),
        })
      );
    });

    it("should never throw (best-effort) when db fails", async () => {
      mockCreate.mockRejectedValueOnce(new Error("DB down"));

      await expect(
        createNotification({
          userId: "user-123",
          type: "system.maintenance",
          title: "Test",
        })
      ).resolves.toBeUndefined();
    });
  });
});
