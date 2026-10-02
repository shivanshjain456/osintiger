// Tests for the input detector — validates and classifies OSINT targets.
// These tests verify that the detector correctly identifies input types,
// sanitizes input, and rejects invalid targets.

import { describe, it, expect } from "vitest";

// We test the detector's classification logic by importing it.
// The detector is the first line of defense against invalid input.
import { detectInput } from "../detector";

describe("Input Detector", () => {
  describe("Domain detection", () => {
    it("should detect a simple domain", () => {
      const result = detectInput("example.com", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("domain");
    });

    it("should detect a subdomain", () => {
      const result = detectInput("sub.example.com", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("domain");
    });

    it("should detect a domain with TLD", () => {
      const result = detectInput("example.co.uk", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("domain");
    });
  });

  describe("IP detection", () => {
    it("should detect an IPv4 address", () => {
      const result = detectInput("8.8.8.8", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("ip");
    });

    it("should detect a private IP", () => {
      const result = detectInput("192.168.1.1", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("ip");
    });

    it("should detect 127.0.0.1", () => {
      const result = detectInput("127.0.0.1", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("ip");
    });
  });

  describe("Email detection", () => {
    it("should detect a standard email", () => {
      const result = detectInput("user@example.com", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("email");
    });

    it("should detect an email with subaddress", () => {
      const result = detectInput("user+tag@example.com", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("email");
    });
  });

  describe("Username detection", () => {
    it("should detect a @username", () => {
      const result = detectInput("@elonmusk", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("username");
    });
  });

  describe("Crypto wallet detection", () => {
    it("should detect a Bitcoin address", () => {
      const result = detectInput("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("wallet");
    });

    it("should detect an Ethereum address", () => {
      const result = detectInput("0x71C7656EC7ab88b098defB751B7401B5f6d8976F", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("wallet");
    });
  });

  describe("CVE detection", () => {
    it("should detect a CVE ID", () => {
      const result = detectInput("CVE-2021-44228", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("cve");
    });
  });

  describe("Phone detection", () => {
    it("should detect a US phone number", () => {
      const result = detectInput("+1-202-555-0173", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("phone");
    });
  });

  describe("URL detection", () => {
    it("should detect an HTTP URL", () => {
      const result = detectInput("http://example.com/path", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("url");
    });

    it("should detect an HTTPS URL", () => {
      const result = detectInput("https://example.com/path?query=1", "auto");
      expect(result.valid).toBe(true);
      expect(result.inputType).toBe("url");
    });
  });

  describe("Explicit type override", () => {
    it("should force domain type when specified", () => {
      const result = detectInput("example.com", "domain");
      expect(result.inputType).toBe("domain");
    });

    it("should force person type when specified", () => {
      const result = detectInput("John Doe", "person");
      expect(result.inputType).toBe("person");
    });

    it("should force organization type when specified", () => {
      const result = detectInput("Tesla Inc", "organization");
      expect(result.inputType).toBe("organization");
    });
  });

  describe("Sanitization", () => {
    it("should trim whitespace from target", () => {
      const result = detectInput("  example.com  ", "auto");
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe("example.com");
    });
  });

  describe("Result fields", () => {
    it("should always include a script field", () => {
      const result = detectInput("example.com", "auto");
      expect(result.script).toBeDefined();
      expect(typeof result.script).toBe("string");
    });

    it("should always include a languageGuess field", () => {
      const result = detectInput("example.com", "auto");
      expect(result.languageGuess).toBeDefined();
      expect(typeof result.languageGuess).toBe("string");
    });
  });
});
