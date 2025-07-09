/**
 * Next.js “instrumentation” entrypoint.
 * ------------------------------------
 * We previously used this file to boot an E2B sandbox-pool on
 * server start.  Since all Python/E2B code has been removed,
 * this is now a simple no-op placeholder kept for potential
 * future server-side hooks (e.g. logging/analytics warm-ups).
 */
export async function register() {
  // No server-side instrumentation needed at the moment.
  // This function intentionally left blank.
}