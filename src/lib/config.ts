// Configuration validation — validates all environment variables at startup.
// Call `validateConfig()` once during application initialization to fail fast
// on missing or invalid configuration before the app starts serving requests.

type ConfigStatus = "ok" | "warning" | "error";

interface ConfigCheck {
  name: string;
  value: string | undefined;
  status: ConfigStatus;
  message: string;
  isSecret: boolean;
  isRequired: boolean;
}

function checkVar(
  name: string,
  opts: {
    required?: boolean;
    isSecret?: boolean;
    minLength?: number;
    validate?: (value: string) => boolean;
    description: string;
  }
): ConfigCheck {
  const value = process.env[name];
  const isRequired = opts.required ?? false;
  const isSecret = opts.isSecret ?? false;

  if (!value || value.trim() === "") {
    if (isRequired) {
      return {
        name,
        value: undefined,
        status: "error",
        message: `Required ${opts.description}. Set ${name} in your .env file.`,
        isSecret,
        isRequired,
      };
    }
    return {
      name,
      value: undefined,
      status: "warning",
      message: `Optional ${opts.description}. Not set — feature will be disabled.`,
      isSecret,
      isRequired,
    };
  }

  if (opts.minLength && value.length < opts.minLength) {
    return {
      name,
      value: isSecret ? `${value.slice(0, 4)}...` : value,
      status: "error",
      message: `${opts.description} must be at least ${opts.minLength} characters.`,
      isSecret,
      isRequired,
    };
  }

  if (opts.validate && !opts.validate(value)) {
    return {
      name,
      value: isSecret ? `${value.slice(0, 4)}...` : value,
      status: "error",
      message: `${opts.description} has an invalid format.`,
      isSecret,
      isRequired,
    };
  }

  // Check for placeholder values in production
  if (process.env.NODE_ENV === "production") {
    const placeholders = ["placeholder", "change-in-production", "change-this", "your-", "dev_placeholder"];
    if (placeholders.some((p) => value.toLowerCase().includes(p))) {
      return {
        name,
        value: isSecret ? `${value.slice(0, 4)}...` : value,
        status: "error",
        message: `${opts.description} appears to be a placeholder value. Set a real value for production.`,
        isSecret,
        isRequired,
      };
    }
  }

  return {
    name,
    value: isSecret ? `${value.slice(0, 4)}...` : value,
    status: "ok",
    message: `${opts.description} configured.`,
    isSecret,
    isRequired,
  };
}

/**
 * Validate all environment variables.
 * Returns the checks array and a summary.
 * Call this at startup to fail fast on misconfiguration.
 */
export function validateConfig(): { checks: ConfigCheck[]; errors: number; warnings: number } {
  const checks: ConfigCheck[] = [
    checkVar("DATABASE_URL", {
      required: true,
      description: "Database connection string",
      validate: (v) => v.startsWith("file:") || v.startsWith("postgres:") || v.startsWith("postgresql:"),
    }),
    checkVar("NEXT_PUBLIC_SUPABASE_URL", {
      required: true,
      description: "Supabase project URL",
      validate: (v) => v.startsWith("http://") || v.startsWith("https://"),
    }),
    checkVar("NEXT_PUBLIC_SUPABASE_ANON_KEY", {
      required: true,
      isSecret: true,
      minLength: 20,
      description: "Supabase anon (public) key",
    }),
    checkVar("SUPABASE_SERVICE_ROLE_KEY", {
      required: true,
      isSecret: true,
      minLength: 20,
      description: "Supabase service role key (server-only)",
    }),
    checkVar("STRIPE_SECRET_KEY", {
      required: true,
      isSecret: true,
      minLength: 10,
      description: "Stripe secret key for payment processing",
      validate: (v) => v.startsWith("sk_"),
    }),
    checkVar("STRIPE_WEBHOOK_SECRET", {
      required: true,
      isSecret: true,
      minLength: 10,
      description: "Stripe webhook signing secret",
      validate: (v) => v.startsWith("whsec_") || v === "",
    }),
    checkVar("NEXT_PUBLIC_URL", {
      required: true,
      description: "Application public URL for canonical/OG/redirects",
      validate: (v) => v.startsWith("http://") || v.startsWith("https://"),
    }),
    checkVar("LLM_ENCRYPTION_KEY", {
      required: true,
      isSecret: true,
      minLength: 32,
      description: "AES-256-GCM encryption key for LLM credentials (32+ chars)",
    }),
    checkVar("ZAI_API_KEY", {
      required: false,
      isSecret: true,
      description: "ZAI web dev SDK API key for AI features",
    }),
    checkVar("ABUSEIPDB_API_KEY", {
      required: false,
      isSecret: true,
      description: "AbuseIPDB API key (optional, higher rate limits)",
    }),
    checkVar("ETHERSCAN_API_KEY", {
      required: false,
      isSecret: true,
      description: "Etherscan API key (optional, higher rate limits)",
    }),
    checkVar("VIRUSTOTAL_API_KEY", {
      required: false,
      isSecret: true,
      description: "VirusTotal API key (optional, higher rate limits)",
    }),
  ];

  const errors = checks.filter((c) => c.status === "error").length;
  const warnings = checks.filter((c) => c.status === "warning").length;

  return { checks, errors, warnings };
}

/**
 * Get a safe (non-secret) configuration summary for the /api/system/diagnostics endpoint.
 * Never returns actual secret values.
 */
export function getConfigSummary(): Record<string, { status: string; message: string }> {
  const { checks } = validateConfig();
  const summary: Record<string, { status: string; message: string }> = {};
  for (const check of checks) {
    summary[check.name] = {
      status: check.status,
      message: check.message,
    };
  }
  return summary;
}
