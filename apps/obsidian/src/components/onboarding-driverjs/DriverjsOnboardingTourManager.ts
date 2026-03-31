import { driver, type Driver } from "driver.js";
import type DiscourseGraphPlugin from "~/index";
import {
  telescopeStep,
  commandPalettePromptStep,
  commandPaletteHighlightStep,
} from "./driverSteps";

type Phase = 1 | 2 | 3;

export class DriverjsOnboardingTourManager {
  private plugin: DiscourseGraphPlugin;
  private currentPhase: Phase | null = null;
  private driverInstance: Driver | null = null;
  private cleanupFns: (() => void)[] = [];
  private running = false;

  constructor(plugin: DiscourseGraphPlugin) {
    this.plugin = plugin;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.addEscapeHandler();
    this.startPhase1();
  }

  stop() {
    this.cleanup();
  }

  private cleanup() {
    this.running = false;
    this.currentPhase = null;

    if (this.driverInstance) {
      this.driverInstance.destroy();
      this.driverInstance = null;
    }

    for (const fn of this.cleanupFns) {
      try {
        fn();
      } catch {
        // ignore cleanup errors
      }
    }
    this.cleanupFns = [];
  }

  // ── Phase 1: Telescope icon ──────────────────────────────

  private startPhase1() {
    this.currentPhase = 1;

    this.driverInstance = driver({
      animate: true,
      showProgress: false,
      showButtons: ["next", "close"],
      nextBtnText: "Next",
      steps: [telescopeStep],
      onNextClick: () => {
        this.driverInstance?.destroy();
        this.driverInstance = null;
        this.startPhase2();
      },
      onCloseClick: () => {
        this.stop();
      },
    });

    this.driverInstance.drive();

    // Also advance if user clicks the telescope icon itself
    const telescopeEl = document.querySelector<HTMLElement>(
      telescopeStep.element as string,
    );
    if (telescopeEl) {
      const clickHandler = () => {
        if (this.currentPhase !== 1) return;
        this.driverInstance?.destroy();
        this.driverInstance = null;
        this.startPhase2();
      };
      telescopeEl.addEventListener("click", clickHandler, { once: true });
      this.cleanupFns.push(() =>
        telescopeEl.removeEventListener("click", clickHandler),
      );
    }
  }

  // ── Phase 2: Floating card (no driver.js target) ─────────

  private startPhase2() {
    this.currentPhase = 2;

    const card = document.createElement("div");
    card.className = "dg-onboarding-floating-card";

    const title = document.createElement("h3");
    title.textContent = commandPalettePromptStep.title;
    card.appendChild(title);

    const desc = document.createElement("p");
    desc.textContent = commandPalettePromptStep.description;
    card.appendChild(desc);

    document.body.appendChild(card);
    this.cleanupFns.push(() => card.remove());

    // Poll for .prompt appearing (command palette opened)
    let rafId: number | null = null;
    const poll = () => {
      if (this.currentPhase !== 2) return;
      const promptEl = document.querySelector(".prompt");
      if (promptEl) {
        card.remove();
        this.startPhase3();
        return;
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    this.cleanupFns.push(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    });
  }

  // ── Phase 3: Command palette highlighted ─────────────────

  private startPhase3() {
    this.currentPhase = 3;

    this.driverInstance = driver({
      animate: true,
      showProgress: false,
      showButtons: ["next", "close"],
      nextBtnText: "Finish",
      steps: [commandPaletteHighlightStep],
      onNextClick: () => {
        this.stop();
      },
      onCloseClick: () => {
        this.stop();
      },
    });

    this.driverInstance.drive();
  }

  // ── Escape key handler ───────────────────────────────────

  private addEscapeHandler() {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.running) {
        e.preventDefault();
        e.stopPropagation();
        this.stop();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    this.cleanupFns.push(() =>
      document.removeEventListener("keydown", handler, { capture: true }),
    );
  }
}
