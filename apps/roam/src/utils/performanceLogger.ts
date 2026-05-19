type PerformanceDetail = string | number | boolean | null | undefined;

type PerformanceDetails = Record<string, PerformanceDetail>;

type PerformanceTraceOptions = {
  label: string;
  thresholdMs?: number;
  aggregateThresholdMs?: number;
  details?: PerformanceDetails | (() => PerformanceDetails);
};

type AggregateSample = {
  count: number;
  totalDurationMs: number;
  slowestDurationMs: number;
  thresholdMs: number;
  details?: PerformanceDetails;
};

type PerformanceDebugWindow = Window &
  typeof globalThis & {
    dgPerformanceDebug?: boolean;
  };

const SLOW_OPERATION_THRESHOLD_MS = 16;
const DEBUG_STORAGE_KEY = "dg:performance-debug";

const aggregateSamples = new Map<string, AggregateSample>();
let aggregateFlushQueued = false;

const getPerformanceNow = (): number => {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }

  return Date.now();
};

const getPerformanceDebugWindow = (): PerformanceDebugWindow | undefined => {
  if (typeof window === "undefined") return undefined;
  return window as PerformanceDebugWindow;
};

const readPerformanceDebugStorage = (): boolean => {
  const debugWindow = getPerformanceDebugWindow();
  if (!debugWindow) return false;

  try {
    return debugWindow.localStorage?.getItem(DEBUG_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const isPerformanceDebugEnabled = (): boolean => {
  const debugWindow = getPerformanceDebugWindow();
  return (
    debugWindow?.dgPerformanceDebug === true || readPerformanceDebugStorage()
  );
};

const resolveDetails = (
  details?: PerformanceDetails | (() => PerformanceDetails),
): PerformanceDetails => {
  if (!details) return {};
  return typeof details === "function" ? details() : details;
};

const compactDetails = (details: PerformanceDetails): PerformanceDetails => {
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  );
};

const formatDuration = (durationMs: number): string => {
  return `${Math.round(durationMs * 10) / 10}ms`;
};

const logPerformance = ({
  label,
  durationMs,
  details,
  aggregate,
}: {
  label: string;
  durationMs: number;
  details?: PerformanceDetails;
  aggregate?: Pick<AggregateSample, "count" | "slowestDurationMs">;
}): void => {
  const compactedDetails = compactDetails(details ?? {});
  const message = aggregate
    ? `[DG Performance] ${label}: ${formatDuration(durationMs)} total across ${
        aggregate.count
      } calls; slowest ${formatDuration(aggregate.slowestDurationMs)}`
    : `[DG Performance] ${label}: ${formatDuration(durationMs)}`;

  console.warn(message, compactedDetails);
};

const scheduleAggregateFlush = (): void => {
  if (aggregateFlushQueued) return;
  aggregateFlushQueued = true;

  const debugWindow = getPerformanceDebugWindow();
  if (debugWindow?.requestAnimationFrame) {
    debugWindow.requestAnimationFrame(flushAggregateSamples);
    return;
  }

  globalThis.setTimeout(flushAggregateSamples, 0);
};

const recordAggregateSample = ({
  label,
  durationMs,
  thresholdMs,
  details,
}: {
  label: string;
  durationMs: number;
  thresholdMs: number;
  details?: PerformanceDetails;
}): void => {
  const existing = aggregateSamples.get(label);
  const nextSample: AggregateSample = existing
    ? {
        ...existing,
        count: existing.count + 1,
        totalDurationMs: existing.totalDurationMs + durationMs,
        slowestDurationMs: Math.max(existing.slowestDurationMs, durationMs),
        thresholdMs: Math.min(existing.thresholdMs, thresholdMs),
        details:
          durationMs >= existing.slowestDurationMs ? details : existing.details,
      }
    : {
        count: 1,
        totalDurationMs: durationMs,
        slowestDurationMs: durationMs,
        thresholdMs,
        details,
      };

  aggregateSamples.set(label, nextSample);
  scheduleAggregateFlush();
};

function flushAggregateSamples(): void {
  aggregateFlushQueued = false;
  const debugEnabled = isPerformanceDebugEnabled();

  aggregateSamples.forEach((sample, label) => {
    if (!debugEnabled && sample.totalDurationMs < sample.thresholdMs) return;

    logPerformance({
      label,
      durationMs: sample.totalDurationMs,
      details: sample.details,
      aggregate: {
        count: sample.count,
        slowestDurationMs: sample.slowestDurationMs,
      },
    });
  });

  aggregateSamples.clear();
}

export const recordPerformanceDuration = ({
  label,
  durationMs,
  thresholdMs = SLOW_OPERATION_THRESHOLD_MS,
  aggregateThresholdMs,
  details,
}: PerformanceTraceOptions & { durationMs: number }): void => {
  const resolvedDetails = resolveDetails(details);

  if (durationMs >= thresholdMs || isPerformanceDebugEnabled()) {
    logPerformance({
      label,
      durationMs,
      details: resolvedDetails,
    });
  }

  if (aggregateThresholdMs !== undefined) {
    recordAggregateSample({
      label,
      durationMs,
      thresholdMs: aggregateThresholdMs,
      details: resolvedDetails,
    });
  }
};

export const withPerformanceTrace = <T>(
  options: PerformanceTraceOptions,
  fn: () => T,
): T => {
  const start = getPerformanceNow();

  try {
    return fn();
  } finally {
    recordPerformanceDuration({
      ...options,
      durationMs: getPerformanceNow() - start,
    });
  }
};

export const withAsyncPerformanceTrace = async <T>(
  options: PerformanceTraceOptions,
  fn: () => Promise<T>,
): Promise<T> => {
  const start = getPerformanceNow();

  try {
    return await fn();
  } finally {
    recordPerformanceDuration({
      ...options,
      durationMs: getPerformanceNow() - start,
    });
  }
};
