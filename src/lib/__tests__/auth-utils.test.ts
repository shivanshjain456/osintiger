// Tests for the auth-utils module — password hashing and user management.
// Bugs here would compromise authentication security.

import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../auth-utils";

describe("Auth Utils", () => {
  describe("hashPassword & verifyPassword", () => {
    it("should hash a password and return a different string", async () => {
      const hash = await hashPassword("testPassword123");
      expect(hash).not.toBe("testPassword123");
      expect(hash).toBeTruthy();
      expect(hash.length).toBeGreaterThan(20);
    });

    it("should verify a correct password against its hash", async () => {
      const hash = await hashPassword("mySecurePassword");
      const isValid = await verifyPassword("mySecurePassword", hash);
      expect(isValid).toBe(true);
    });

    it("should reject an incorrect password", async () => {
      const hash = await hashPassword("correctPassword");
      const isValid = await verifyPassword("wrongPassword", hash);
      expect(isValid).toBe(false);
    });

    it("should produce different hashes for the same password (salt)", async () => {
      const hash1 = await hashPassword("samePassword");
      const hash2 = await hashPassword("samePassword");
      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty password", async () => {
      const hash = await hashPassword("");
      expect(hash).toBeTruthy();
      const isValid = await verifyPassword("", hash);
      expect(isValid).toBe(true);
    });

    it("should handle unicode passwords", async () => {
      const password = "пароль123🔒";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should handle long passwords", async () => {
      const password = "a".repeat(1000);
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should handle passwords with special characters", async () => {
      const password = 'P@$$w0rd!#$%^&*()';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });
  });
});
