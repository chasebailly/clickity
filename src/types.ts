export type ClickButton = "left" | "middle" | "right";
export type RepeatMode = "count" | "untilStopped";
export type PositionMode = "current" | "fixed";

export interface ClickitySettings {
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  button: ClickButton;
  repeatMode: RepeatMode;
  repeatCount: number;
  positionMode: PositionMode;
  x: number;
  y: number;
  hotkey: string;
  hotkeyDisplay: string;
}

export interface ClickConfig {
  intervalMs: number;
  button: ClickButton;
  repeat:
    | { mode: "count"; clicks: number }
    | { mode: "untilStopped" };
  position:
    | { mode: "current" }
    | { mode: "fixed"; x: number; y: number };
}

export type RunPhase = "idle" | "running" | "error";

export interface RuntimeSnapshot {
  phase: RunPhase;
  clicksCompleted: number;
  targetClicks: number | null;
  intervalMs: number;
  message: string | null;
}

export interface PlatformInfo {
  os: string;
  sessionType: string | null;
  waylandWarning: boolean;
}

export interface InitialState {
  runtime: RuntimeSnapshot;
  hotkey: string;
  hotkeyRegistered: boolean;
  hotkeyError: string | null;
  platform: PlatformInfo;
}

export interface CursorPosition {
  x: number;
  y: number;
}

export interface PositionCaptureResult {
  position: CursorPosition | null;
  error: string | null;
}

export interface ValidationErrors {
  interval?: string;
  repeat?: string;
  position?: string;
}
