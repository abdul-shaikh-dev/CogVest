export function startPerformanceProbe() {
  const intervalMs = 50;
  let expected = performance.now() + intervalMs;
  let maximumDelay = 0;
  let samples = 0;
  let windowStartedAt = performance.now();
  const heartbeat = setInterval(() => {
    const now = performance.now();
    maximumDelay = Math.max(maximumDelay, now - expected, 0);
    expected = now + intervalMs;
    samples += 1;
  }, intervalMs);
  const reporting = setInterval(() => {
    const now = performance.now();
    console.info("[cogvest-performance]", JSON.stringify({ samples,
      windowMs: now - windowStartedAt, maximumDelayMs: maximumDelay }));
    windowStartedAt = now;
    maximumDelay = 0;
    samples = 0;
  }, 5000);
  return () => { clearInterval(heartbeat); clearInterval(reporting); };
}
