// Next.js instrumentation hook — runs once on server startup.
// Catches unhandled promise rejections to prevent server crashes.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason, promise) => {
      console.error("[unhandledRejection]", reason);
    });
    process.on("uncaughtException", (err) => {
      console.error("[uncaughtException]", err);
    });
  }
}
