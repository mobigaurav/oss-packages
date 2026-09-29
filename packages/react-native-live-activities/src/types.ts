/**
 * Common ContentState shape used by the bundled widget template. Covers the majority of
 * Live Activity use cases (timers, progress bars, delivery/ETA banners, live scores).
 * If you need fields beyond this, extend `LiveActivityAttributes.ContentState` in
 * widget-template/LiveActivityAttributes.swift (copy it into your app, see README) and use
 * `extraDataJson` as an escape hatch for anything that doesn't fit these fields.
 */
export interface LiveActivityContentState {
  title: string;
  subtitle?: string;
  /** 0.0–1.0. Renders as a progress bar in the bundled template. */
  progress?: number;
  /** Unix epoch millis. Used for the built-in countdown/ETA text. */
  endDate?: number;
  /** Escape hatch: JSON-encode anything not covered by the fields above; parse it in your own widget UI. */
  extraDataJson?: string;
}

export type DismissalPolicy = 'immediate' | 'default' | 'after';

export interface EndActivityOptions {
  policy?: DismissalPolicy;
  /** Required when policy === 'after'. Unix epoch millis. */
  afterDate?: number;
  finalState?: LiveActivityContentState;
}

export type PushTokenListener = (activityId: string, pushTokenHex: string) => void;
