type PerformanceDetail = string | number | boolean | null | undefined;

type PerformanceDetails = Record<string, PerformanceDetail>;

type PerformanceTraceOptions = {
  label: string;
  thresholdMs?: number;
  aggregateThresholdMs?: number;
  details?: PerformanceDetails | (() => PerformanceDetails);
};

export type PerformanceTraceContext = {
  traceId?: string;
  source?: string;
  content?: string;
};

export type PerformanceTraceArg = string | PerformanceTraceContext | undefined;

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
const INTERNAL_CALLER_PATTERNS = [
  "getPerformanceCaller",
  "resolvePerformanceTraceContext",
  "normalizePerformanceTraceArg",
];

const aggregateSamples = new Map<string, AggregateSample>();
let aggregateFlushQueued = false;

export const getPerformanceNow = (): number => {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }

  return Date.now();
};

export const roundPerformanceDurationMs = (durationMs: number): number =>
  Math.round(durationMs * 10) / 10;

export const measurePerformanceStep = <T>(fn: () => T): [T, number] => {
  const start = getPerformanceNow();
  const result = fn();
  return [result, roundPerformanceDurationMs(getPerformanceNow() - start)];
};

export const normalizePerformanceTraceArg = (
  trace?: PerformanceTraceArg,
): PerformanceTraceContext => {
  if (typeof trace === "string") return { traceId: trace };
  return trace ?? {};
};

export const getPerformanceCaller = (
  ignoredPatterns: string[] = [],
): string | undefined => {
  const stack = new Error().stack;
  if (!stack) return undefined;
  const ignored = INTERNAL_CALLER_PATTERNS.concat(ignoredPatterns);

  return stack
    .split("\n")
    .slice(2)
    .map((line) => line.trim().replace(/^at\s+/, ""))
    .find(
      (line) =>
        line.length > 0 && !ignored.some((pattern) => line.includes(pattern)),
    );
};

export const resolvePerformanceTraceContext = ({
  trace,
  ignoredPatterns,
}: {
  trace?: PerformanceTraceArg;
  ignoredPatterns: string[];
}): PerformanceTraceContext => {
  const context = normalizePerformanceTraceArg(trace);
  return {
    traceId: context.traceId,
    source: context.source ?? getPerformanceCaller(ignoredPatterns),
    content: context.content,
  };
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
  return `${roundPerformanceDurationMs(durationMs)}ms`;
};

const formatDetailValue = (value: PerformanceDetail): string => {
  if (typeof value === "string") return `"${value}"`;
  return String(value);
};

const formatDetails = (details: PerformanceDetails): string => {
  const formattedDetails = Object.entries(details)
    .map(([key, value]) => `${key}: ${formatDetailValue(value)}`)
    .join(", ");
  if (!formattedDetails) return "";
  return ` { ${formattedDetails} }`;
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

  console.log(`${message}${formatDetails(compactedDetails)}`);
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
