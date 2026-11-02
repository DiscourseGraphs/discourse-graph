import { vi } from "vitest";

// posthog-js touches `window.addEventListener` at import time when a global
// `window` exists. Tests stub `window` with plain objects, so the real module
// throws on load. Test files may still override this with their own mock.
vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
    captureException: vi.fn(),
    identify: vi.fn(),
    init: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    register_for_session: vi.fn(),
  },
}));
