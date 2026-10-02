import { describe, it, expect } from "vitest";
import { encryptApiKey, decryptApiKey } from "../llm-provider";

describe("LLM Provider Credential Security", () => {
  describe("AES-256-GCM Encryption at Rest", () => {
    const rawApiKey = "sk-proj-test-secret-api-key-1234567890abcdef";

    it("should encrypt an API key into a three-part hex token (iv:tag:ciphertext)", () => {
      const encrypted = encryptApiKey(rawApiKey);
      expect(encrypted).not.toContain(rawApiKey);
      const parts = encrypted.split(":");
      expect(parts.length).toBe(3);
      expect(parts[0].length).toBe(32); // 16 bytes IV in hex
      expect(parts[1].length).toBe(32); // 16 bytes GCM Auth Tag in hex
      expect(parts[2].length).toBeGreaterThan(0); // Ciphertext in hex
    });

    it("should produce non-deterministic ciphertext for identical keys (unique IV per call)", () => {
      const enc1 = encryptApiKey(rawApiKey);
      const enc2 = encryptApiKey(rawApiKey);
      expect(enc1).not.toBe(enc2);
      expect(enc1.split(":")[0]).not.toBe(enc2.split(":")[0]); // Different IVs
    });

    it("should accurately decrypt ciphertext back to original plaintext", () => {
      const encrypted = encryptApiKey(rawApiKey);
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe(rawApiKey);
    });

    it("should reject tampered ciphertext with authentication error", () => {
      const encrypted = encryptApiKey(rawApiKey);
      const parts = encrypted.split(":");
      // Alter one character in ciphertext
      const tamperedCiphertext = parts[0] + ":" + parts[1] + ":" + (parts[2].slice(0, -2) + "ff");
      expect(() => decryptApiKey(tamperedCiphertext)).toThrow();
    });

    it("should reject tampered authentication tag", () => {
      const encrypted = encryptApiKey(rawApiKey);
      const parts = encrypted.split(":");
      // Alter authentication tag
      const tamperedTag = parts[0] + ":" + "00".repeat(16) + ":" + parts[2];
      expect(() => decryptApiKey(tamperedTag)).toThrow();
    });

    it("should reject malformed ciphertext strings", () => {
      expect(() => decryptApiKey("invalid-non-colon-string")).toThrow("Invalid ciphertext format");
      expect(() => decryptApiKey("part1:part2")).toThrow("Invalid ciphertext format");
    });
  });
});
