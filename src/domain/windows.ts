export type WindowState = "MISSING" | "INSIDE" | "OUTSIDE";

export type WindowReason = "MISSING_DATES" | "MISSING_PHASE" | "STARTS_BEFORE_PHASE" | "ENDS_AFTER_PHASE";

export interface ConstructionWindow {
  start: string | null;
  end: string | null;
}

export interface PhaseWindow {
  start: string | null;
  end: string | null;
}

export interface WindowCheck {
  state: WindowState;
  reasons: WindowReason[];
}

/**
 * A construction window is flagged only when it is missing or falls outside
 * Phase 2 (平台建立). Overlapping windows between platforms are not conflicts:
 * platforms build in parallel, so this function judges one window at a time.
 */
export function evaluateConstructionWindow(
  window: ConstructionWindow,
  phase: PhaseWindow | null,
): WindowCheck {
  if (!window.start || !window.end) {
    return { state: "MISSING", reasons: ["MISSING_DATES"] };
  }
  if (!phase?.start || !phase.end) {
    return { state: "OUTSIDE", reasons: ["MISSING_PHASE"] };
  }
  const reasons: WindowReason[] = [];
  if (window.start < phase.start) reasons.push("STARTS_BEFORE_PHASE");
  if (window.end > phase.end) reasons.push("ENDS_AFTER_PHASE");
  return reasons.length === 0 ? { state: "INSIDE", reasons: [] } : { state: "OUTSIDE", reasons };
}
