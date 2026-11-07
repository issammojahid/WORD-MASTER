const now = () => (
  typeof performance !== "undefined" ? performance.now() : Date.now()
);

const startupStartedAt = now();

export function startupNow(): number {
  return now();
}

export function markStartup(name: string): void {
  if (__DEV__) {
    console.info(`[startup] ${name} at ${Math.round(now() - startupStartedAt)}ms`);
  }
}

export function markStartupDuration(name: string, startedAt: number): void {
  if (__DEV__) {
    console.info(
      `[startup] ${name} completed in ${Math.round(now() - startedAt)}ms (at ${Math.round(now() - startupStartedAt)}ms)`,
    );
  }
}
