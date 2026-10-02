"use client";

// Supabase Auth Views — production-grade authentication UI.
// Every view uses the real Supabase Auth API via the useAuth() hook.
// No mocks, no stubs, no NextAuth — pure Supabase.

import { useState, useEffect, type FormEvent } from "react";
import {
  LogIn,
  UserPlus,
  KeyRound,
  MailCheck,
  CircleUser,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Shield,
  Zap,
  Github,
  Chrome,
} from "lucide-react";
import { useAuth } from "@/lib/supabase/auth-context";
import { useNavigate, useRoute } from "@/lib/router/useRouter";
import { PageHeader } from "./PageBits";
import { RouteBreadcrumbs } from "./RouteBreadcrumbs";

function Shell({ children, maxWidth = "max-w-md" }: { children: React.ReactNode; maxWidth?: string }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <RouteBreadcrumbs />
      <div className={`mx-auto ${maxWidth}`}>{children}</div>
    </div>
  );
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="terminal-panel p-6 md:p-8">
      <h1 className="text-xl font-bold font-mono text-[var(--hack-green)] tracking-tight mb-1">{title}</h1>
      {subtitle && <p className="text-xs text-[var(--hack-gray)] font-mono mb-6">{subtitle}</p>}
      {children}
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  icon: Icon,
  showToggle,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  icon?: typeof Mail;
  showToggle?: boolean;
}) {
  const [show, setShow] = useState(false);
  const inputType = showToggle ? (show ? "text" : "password") : type;
  return (
    <div>
      <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--hack-gray)] mb-1">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--hack-green)]/50" />}
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className={`w-full ${Icon ? "pl-9" : "pl-3"} ${showToggle ? "pr-9" : "pr-3"} h-10 bg-[var(--hack-surface)] border border-[var(--hack-border)] text-sm font-mono text-[var(--hack-green)] placeholder:text-[var(--hack-gray)]/40 focus:outline-none focus:border-[var(--hack-green)]/50 transition`}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--hack-gray)] hover:text-[var(--hack-green)]"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function ErrorMsg({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5 px-3 py-2">
      <AlertCircle className="h-4 w-4 text-[var(--hack-red)] shrink-0 mt-0.5" />
      <p className="text-xs text-[var(--hack-red)] font-mono">{message}</p>
    </div>
  );
}

function SuccessMsg({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 px-3 py-2">
      <CheckCircle2 className="h-4 w-4 text-[var(--hack-green)] shrink-0 mt-0.5" />
      <p className="text-xs text-[var(--hack-green)] font-mono">{message}</p>
    </div>
  );
}

function SubmitButton({ loading, children, disabled }: { loading: boolean; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full h-10 border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 text-[var(--hack-green)] font-mono text-xs uppercase tracking-wider hover:bg-[var(--hack-green)]/20 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────
function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="h-px flex-1 bg-[var(--hack-border)]" />
      <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--hack-gray)]/60">{label}</span>
      <div className="h-px flex-1 bg-[var(--hack-border)]" />
    </div>
  );
}

// ─── OAuth Buttons ───────────────────────────────────────────────────────────
function OAuthButtons() {
  const { signInWithOAuth } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  async function handleOAuth(provider: "google" | "github") {
    setLoadingProvider(provider);
    const { error } = await signInWithOAuth(provider);
    if (error) setLoadingProvider(null);
    // On success, Supabase redirects — no need to clear loading state.
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => handleOAuth("google")}
        disabled={!!loadingProvider}
        className="w-full h-10 border border-[var(--hack-border)] bg-[var(--hack-surface)] text-[var(--hack-gray)] font-mono text-xs uppercase tracking-wider hover:border-[var(--hack-green)]/40 hover:text-[var(--hack-green)] disabled:opacity-40 transition flex items-center justify-center gap-2"
      >
        {loadingProvider === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
        Continue with Google
      </button>
      <button
        type="button"
        onClick={() => handleOAuth("github")}
        disabled={!!loadingProvider}
        className="w-full h-10 border border-[var(--hack-border)] bg-[var(--hack-surface)] text-[var(--hack-gray)] font-mono text-xs uppercase tracking-wider hover:border-[var(--hack-green)]/40 hover:text-[var(--hack-green)] disabled:opacity-40 transition flex items-center justify-center gap-2"
      >
        {loadingProvider === "github" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
        Continue with GitHub
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN VIEW
// ═══════════════════════════════════════════════════════════════════════════════
export function LoginView() {
  const navigate = useNavigate();
  const route = useRoute();
  const { signInWithPassword, signInWithOtp, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect to billing (or next param).
  useEffect(() => {
    if (!authLoading && user) {
      const urlError = route.name === "login" ? null : null;
      navigate({ name: "billing" });
    }
  }, [user, authLoading, navigate, route.name]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    const { error } = await signInWithPassword(email.trim(), password);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      navigate({ name: "billing" });
    }
  }

  async function handleMagicLink() {
    if (!email.trim()) {
      setError("Enter your email first to receive a magic link.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await signInWithOtp(email.trim());
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setMagicLinkSent(true);
    }
  }

  return (
    <Shell>
      <AuthCard title="Sign In" subtitle="// welcome back, analyst">
        {/* Read error from URL (e.g. from OAuth redirect failures) */}
        {typeof window !== "undefined" && window.location.hash.includes("error=") && (
          <div className="mb-4">
            <ErrorMsg message={decodeURIComponent(window.location.hash.split("error=")[1]?.split("&")[0] || "")} />
          </div>
        )}

        <OAuthButtons />

        <Divider label="or sign in with email" />

        {magicLinkSent ? (
          <SuccessMsg message={`Magic link sent to ${email}. Check your inbox and click the link to sign in.`} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required autoComplete="email" icon={Mail} />
            <Field label="Password" value={password} onChange={setPassword} placeholder="••••••••" required autoComplete="current-password" icon={Lock} showToggle />
            {error && <ErrorMsg message={error} />}
            <SubmitButton loading={loading} disabled={!email.trim() || !password}>
              <LogIn className="h-4 w-4" /> Sign In
            </SubmitButton>
          </form>
        )}

        <div className="mt-4 flex items-center justify-between text-[11px] font-mono">
          <button onClick={() => navigate({ name: "forgot-password" })} className="text-[var(--hack-cyan)] hover:underline">
            Forgot password?
          </button>
          <button onClick={() => navigate({ name: "signup" })} className="text-[var(--hack-gray)] hover:text-[var(--hack-green)]">
            No account? <span className="text-[var(--hack-green)]">Sign up</span>
          </button>
        </div>

        {!magicLinkSent && (
          <button onClick={handleMagicLink} className="mt-3 w-full text-center text-[10px] font-mono text-[var(--hack-gray)]/60 hover:text-[var(--hack-cyan)] transition">
            or send a magic link instead →
          </button>
        )}
      </AuthCard>

      <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-mono text-[var(--hack-gray)]/50">
        <Shield className="h-3 w-3" />
        <span>Secured by Supabase Auth · End-to-end encrypted sessions</span>
      </div>
    </Shell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNUP VIEW
// ═══════════════════════════════════════════════════════════════════════════════
export function SignupView() {
  const navigate = useNavigate();
  const { signUp, user, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate({ name: "billing" });
  }, [user, authLoading, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name is required");
    if (!email.trim()) return setError("Email is required");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirm) return setError("Passwords do not match");

    setLoading(true);
    const { error, needsEmailConfirm } = await signUp(email.trim(), password, name.trim());
    setLoading(false);

    if (error) {
      setError(error);
    } else if (needsEmailConfirm) {
      setNeedsConfirm(true);
    } else {
      // Signed in immediately (email confirmation disabled).
      navigate({ name: "billing" });
    }
  }

  if (needsConfirm) {
    return (
      <Shell>
        <AuthCard title="Check Your Email" subtitle="// verification required">
          <div className="text-center py-4">
            <MailCheck className="h-12 w-12 text-[var(--hack-green)] mx-auto mb-4" />
            <p className="text-sm text-[var(--hack-gray)] font-mono mb-2">
              We sent a confirmation link to
            </p>
            <p className="text-sm font-mono text-[var(--hack-green)] mb-4">{email}</p>
            <p className="text-xs text-[var(--hack-gray)]/70 font-mono mb-6">
              Click the link in the email to activate your account. You can close this tab.
            </p>
            <button
              onClick={() => navigate({ name: "verify-email", query: { email } })}
              className="text-xs font-mono text-[var(--hack-cyan)] hover:underline"
            >
              I've confirmed — continue →
            </button>
          </div>
        </AuthCard>
      </Shell>
    );
  }

  return (
    <Shell>
      <AuthCard title="Create Account" subtitle="// start investigating in seconds">
        {/* Value prop */}
        <div className="mb-4 border border-[var(--hack-green)]/20 bg-[var(--hack-green)]/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-3.5 w-3.5 text-[var(--hack-green)]" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--hack-green)]">Free tier includes</span>
          </div>
          <ul className="text-[10px] font-mono text-[var(--hack-gray)] space-y-0.5 ml-5">
            <li>• 3 investigations per month</li>
            <li>• 10 AI synthesis credits</li>
            <li>• 20 basic OSINT sources</li>
            <li>• No credit card required</li>
          </ul>
        </div>

        <OAuthButtons />

        <Divider label="or sign up with email" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Name" value={name} onChange={setName} placeholder="Jane Analyst" required autoComplete="name" icon={CircleUser} />
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required autoComplete="email" icon={Mail} />
          <Field label="Password" value={password} onChange={setPassword} placeholder="min 8 characters" required autoComplete="new-password" icon={Lock} showToggle />
          <Field label="Confirm Password" value={confirm} onChange={setConfirm} placeholder="repeat password" required autoComplete="new-password" icon={Lock} showToggle />
          {error && <ErrorMsg message={error} />}
          <SubmitButton loading={loading} disabled={!name.trim() || !email.trim() || !password || !confirm}>
            <UserPlus className="h-4 w-4" /> Create Account
          </SubmitButton>
        </form>

        <div className="mt-4 text-center text-[11px] font-mono">
          <span className="text-[var(--hack-gray)]">Already have an account? </span>
          <button onClick={() => navigate({ name: "login" })} className="text-[var(--hack-green)] hover:underline">
            Sign in
          </button>
        </div>

        <div className="mt-3 text-center text-[9px] font-mono text-[var(--hack-gray)]/50">
          By creating an account, you agree to our{" "}
          <button onClick={() => navigate({ name: "docs-terms" })} className="underline hover:text-[var(--hack-cyan)]">Terms</button>
          {" & "}
          <button onClick={() => navigate({ name: "docs-privacy" })} className="underline hover:text-[var(--hack-cyan)]">Privacy Policy</button>
        </div>
      </AuthCard>
    </Shell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD VIEW
// ═══════════════════════════════════════════════════════════════════════════════
export function ForgotPasswordView() {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const { error } = await resetPassword(email.trim());
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setSent(true);
    }
  }

  return (
    <Shell>
      <AuthCard title="Forgot Password" subtitle="// we'll send you a reset link">
        {sent ? (
          <div className="text-center py-4">
            <MailCheck className="h-12 w-12 text-[var(--hack-green)] mx-auto mb-4" />
            <p className="text-sm text-[var(--hack-gray)] font-mono mb-2">Reset link sent to</p>
            <p className="text-sm font-mono text-[var(--hack-green)] mb-4">{email}</p>
            <p className="text-xs text-[var(--hack-gray)]/70 font-mono mb-6">
              Check your inbox and click the link to set a new password. The link expires in 1 hour.
            </p>
            <button onClick={() => navigate({ name: "login" })} className="text-xs font-mono text-[var(--hack-cyan)] hover:underline">
              ← Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required autoComplete="email" icon={Mail} />
            {error && <ErrorMsg message={error} />}
            <SubmitButton loading={loading} disabled={!email.trim()}>
              <KeyRound className="h-4 w-4" /> Send Reset Link
            </SubmitButton>
          </form>
        )}

        <div className="mt-4 text-center">
          <button onClick={() => navigate({ name: "login" })} className="text-[11px] font-mono text-[var(--hack-gray)] hover:text-[var(--hack-green)]">
            ← Back to sign in
          </button>
        </div>
      </AuthCard>
    </Shell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESET PASSWORD VIEW
// ═══════════════════════════════════════════════════════════════════════════════
export function ResetPasswordView({ status: initialStatus }: { status?: string }) {
  const navigate = useNavigate();
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const verified = initialStatus === "verified";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirm) return setError("Passwords do not match");

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);

    if (error) {
      setError(error);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <Shell>
        <AuthCard title="Password Updated" subtitle="// you're all set">
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-[var(--hack-green)] mx-auto mb-4" />
            <p className="text-sm text-[var(--hack-gray)] font-mono mb-6">
              Your password has been updated successfully.
            </p>
            <button
              onClick={async () => { await signOut(); navigate({ name: "login" }); }}
              className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 transition"
            >
              Sign in with new password
            </button>
          </div>
        </AuthCard>
      </Shell>
    );
  }

  return (
    <Shell>
      <AuthCard title="Set New Password" subtitle={verified ? "// email verified — set your new password" : "// enter your new password"}>
        {verified && (
          <div className="mb-4">
            <SuccessMsg message="Email verified successfully. Set your new password below." />
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="New Password" value={password} onChange={setPassword} placeholder="min 8 characters" required autoComplete="new-password" icon={Lock} showToggle />
          <Field label="Confirm Password" value={confirm} onChange={setConfirm} placeholder="repeat password" required autoComplete="new-password" icon={Lock} showToggle />
          {error && <ErrorMsg message={error} />}
          <SubmitButton loading={loading} disabled={!password || !confirm}>
            <KeyRound className="h-4 w-4" /> Update Password
          </SubmitButton>
        </form>
      </AuthCard>
    </Shell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFY EMAIL VIEW
// ═══════════════════════════════════════════════════════════════════════════════
export function VerifyEmailView({ email: initialEmail }: { email?: string }) {
  const navigate = useNavigate();
  const { resendEmailVerification, refresh, user } = useAuth();
  const [email] = useState(initialEmail || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  // If the user becomes verified (session established after clicking email link),
  // redirect to billing.
  useEffect(() => {
    if (user?.email_confirmed_at) {
      navigate({ name: "billing" });
    }
  }, [user, navigate]);

  async function handleResend() {
    if (!email) return;
    setLoading(true);
    setError(null);
    const { error } = await resendEmailVerification(email);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setResent(true);
    }
  }

  async function handleCheckVerified() {
    await refresh();
  }

  return (
    <Shell>
      <AuthCard title="Verify Your Email" subtitle="// almost there">
        <div className="text-center py-2">
          <MailCheck className="h-12 w-12 text-[var(--hack-green)] mx-auto mb-4" />
          <p className="text-sm text-[var(--hack-gray)] font-mono mb-2">
            We sent a verification link to
          </p>
          {email && <p className="text-sm font-mono text-[var(--hack-green)] mb-4">{email}</p>}
          <p className="text-xs text-[var(--hack-gray)]/70 font-mono mb-6">
            Click the link in the email to activate your account. Then click the button below to continue.
          </p>

          {error && <div className="mb-4"><ErrorMsg message={error} /></div>}
          {resent && <div className="mb-4"><SuccessMsg message="Verification email resent. Check your inbox." /></div>}

          <div className="space-y-2">
            <button
              onClick={handleCheckVerified}
              className="w-full h-10 border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 text-[var(--hack-green)] font-mono text-xs uppercase tracking-wider hover:bg-[var(--hack-green)]/20 transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" /> I've Verified — Continue
            </button>
            <button
              onClick={handleResend}
              disabled={loading || !email}
              className="w-full text-[11px] font-mono text-[var(--hack-gray)] hover:text-[var(--hack-cyan)] disabled:opacity-40 transition"
            >
              {loading ? "Sending…" : "Resend verification email →"}
            </button>
          </div>
        </div>
      </AuthCard>
    </Shell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT VIEW
// ═══════════════════════════════════════════════════════════════════════════════
export function AccountView() {
  const navigate = useNavigate();
  const { user, signOut, updateProfile, updatePassword } = useAuth();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      queueMicrotask(() => {
        setName((user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || "");
        setAvatarUrl((user.user_metadata?.avatar_url as string) || "");
      });
    }
  }, [user]);

  // If not logged in, redirect to login.
  useEffect(() => {
    // Give the auth provider time to restore the session.
    const timer = setTimeout(() => {
      if (!user) navigate({ name: "login" });
    }, 1500);
    return () => clearTimeout(timer);
  }, [user, navigate]);

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    const { error } = await updateProfile({ name, avatarUrl });
    setSavingProfile(false);
    setProfileMsg(error ? { type: "error", text: error } : { type: "success", text: "Profile updated." });
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword.length < 8) return setPasswordMsg({ type: "error", text: "Password must be at least 8 characters" });
    if (newPassword !== confirmPassword) return setPasswordMsg({ type: "error", text: "Passwords do not match" });
    setSavingPassword(true);
    const { error } = await updatePassword(newPassword);
    setSavingPassword(false);
    if (error) {
      setPasswordMsg({ type: "error", text: error });
    } else {
      setPasswordMsg({ type: "success", text: "Password changed." });
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  if (!user) {
    return (
      <Shell>
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      </Shell>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <RouteBreadcrumbs />
      <PageHeader icon={CircleUser} title="Account" subtitle="// manage your profile & security" />

      {/* Profile section */}
      <div className="terminal-panel p-6 mb-4">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--hack-green)] mb-4">Profile</h2>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="flex items-center gap-4">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url as string} alt="Avatar" className="h-16 w-16 rounded-full border border-[var(--hack-border)]" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5">
                <CircleUser className="h-8 w-8 text-[var(--hack-green)]" />
              </div>
            )}
            <div>
              <p className="text-sm font-mono text-[var(--hack-green)]">{user.email}</p>
              <p className="text-[10px] font-mono text-[var(--hack-gray)]/60">
                {user.email_confirmed_at ? "✓ Email verified" : "⚠ Email not verified"}
                {" · "}
                {user.app_metadata?.provider ? `Signed in via ${user.app_metadata.provider}` : "Email/password"}
              </p>
            </div>
          </div>
          <Field label="Display Name" value={name} onChange={setName} placeholder="Your name" icon={CircleUser} />
          <Field label="Avatar URL" value={avatarUrl} onChange={setAvatarUrl} placeholder="https://..." />
          {profileMsg && (
            profileMsg.type === "success"
              ? <SuccessMsg message={profileMsg.text} />
              : <ErrorMsg message={profileMsg.text} />
          )}
          <button type="submit" disabled={savingProfile} className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 disabled:opacity-40 transition flex items-center gap-2">
            {savingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Profile
          </button>
        </form>
      </div>

      {/* Change password section */}
      <div className="terminal-panel p-6 mb-4">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--hack-green)] mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <Field label="New Password" value={newPassword} onChange={setNewPassword} placeholder="min 8 characters" autoComplete="new-password" icon={Lock} showToggle />
          <Field label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="repeat password" autoComplete="new-password" icon={Lock} showToggle />
          {passwordMsg && (
            passwordMsg.type === "success"
              ? <SuccessMsg message={passwordMsg.text} />
              : <ErrorMsg message={passwordMsg.text} />
          )}
          <button type="submit" disabled={savingPassword || !newPassword} className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 disabled:opacity-40 transition flex items-center gap-2">
            {savingPassword && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Update Password
          </button>
        </form>
      </div>

      {/* Session & security */}
      <div className="terminal-panel p-6 mb-4">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--hack-green)] mb-4">Session</h2>
        <div className="space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-[var(--hack-gray)]">User ID</span>
            <code className="text-[var(--hack-cyan)]">{user.id.slice(0, 16)}…</code>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--hack-gray)]">Last sign in</span>
            <span className="text-[var(--hack-green)]">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--hack-gray)]">Created</span>
            <span className="text-[var(--hack-green)]">{new Date(user.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={async () => { await signOut(); navigate({ name: "home" }); }}
          className="border border-[var(--hack-border)] px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-gray)] hover:text-[var(--hack-red)] hover:border-[var(--hack-red)]/40 transition flex items-center gap-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Sign Out
        </button>
        <button
          onClick={() => navigate({ name: "billing" })}
          className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 transition flex items-center gap-2"
        >
          Billing <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
