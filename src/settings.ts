import type {
  ClickConfig,
  ClickitySettings,
  ValidationErrors,
} from "./types";

const SETTINGS_KEY = "clickity.settings.v1";

export const DEFAULT_SETTINGS: ClickitySettings = {
  hours: 0,
  minutes: 0,
  seconds: 1,
  milliseconds: 0,
  button: "left",
  repeatMode: "count",
  repeatCount: 10,
  positionMode: "current",
  x: 0,
  y: 0,
  hotkey: "F6",
  hotkeyDisplay: "F6",
};

function finiteInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : fallback;
}

export function loadSettings(): ClickitySettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as
      | Partial<ClickitySettings>
      | null;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SETTINGS };

    return {
      hours: finiteInteger(parsed.hours, DEFAULT_SETTINGS.hours),
      minutes: finiteInteger(parsed.minutes, DEFAULT_SETTINGS.minutes),
      seconds: finiteInteger(parsed.seconds, DEFAULT_SETTINGS.seconds),
      milliseconds: finiteInteger(
        parsed.milliseconds,
        DEFAULT_SETTINGS.milliseconds,
      ),
      button: ["left", "middle", "right"].includes(parsed.button ?? "")
        ? (parsed.button as ClickitySettings["button"])
        : DEFAULT_SETTINGS.button,
      repeatMode: ["count", "untilStopped"].includes(
        parsed.repeatMode ?? "",
      )
        ? (parsed.repeatMode as ClickitySettings["repeatMode"])
        : DEFAULT_SETTINGS.repeatMode,
      repeatCount: finiteInteger(
        parsed.repeatCount,
        DEFAULT_SETTINGS.repeatCount,
      ),
      positionMode: ["current", "fixed"].includes(
        parsed.positionMode ?? "",
      )
        ? (parsed.positionMode as ClickitySettings["positionMode"])
        : DEFAULT_SETTINGS.positionMode,
      x: finiteInteger(parsed.x, DEFAULT_SETTINGS.x),
      y: finiteInteger(parsed.y, DEFAULT_SETTINGS.y),
      hotkey:
        typeof parsed.hotkey === "string" && parsed.hotkey.trim()
          ? parsed.hotkey
          : DEFAULT_SETTINGS.hotkey,
      hotkeyDisplay:
        typeof parsed.hotkeyDisplay === "string" && parsed.hotkeyDisplay.trim()
          ? parsed.hotkeyDisplay
          : DEFAULT_SETTINGS.hotkeyDisplay,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: ClickitySettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function intervalInMilliseconds(settings: ClickitySettings): number {
  return (
    settings.hours * 3_600_000 +
    settings.minutes * 60_000 +
    settings.seconds * 1_000 +
    settings.milliseconds
  );
}

export function validateSettings(
  settings: ClickitySettings,
): ValidationErrors {
  const errors: ValidationErrors = {};
  const intervalParts = [
    settings.hours,
    settings.minutes,
    settings.seconds,
    settings.milliseconds,
  ];

  if (
    intervalParts.some((value) => !Number.isSafeInteger(value)) ||
    settings.hours < 0 ||
    settings.hours > 9_999 ||
    settings.minutes < 0 ||
    settings.minutes > 59 ||
    settings.seconds < 0 ||
    settings.seconds > 59 ||
    settings.milliseconds < 0 ||
    settings.milliseconds > 999
  ) {
    errors.interval = "Enter whole numbers within the shown ranges.";
  } else if (intervalInMilliseconds(settings) === 0) {
    errors.interval = "Set an interval greater than 0.";
  }

  if (
    settings.repeatMode === "count" &&
    (!Number.isSafeInteger(settings.repeatCount) ||
      settings.repeatCount < 1 ||
      settings.repeatCount > 1_000_000_000)
  ) {
    errors.repeat = "Enter a whole number from 1 to 1,000,000,000.";
  }

  if (
    settings.positionMode === "fixed" &&
    (!Number.isSafeInteger(settings.x) ||
      !Number.isSafeInteger(settings.y) ||
      settings.x < -2_147_483_648 ||
      settings.x > 2_147_483_647 ||
      settings.y < -2_147_483_648 ||
      settings.y > 2_147_483_647)
  ) {
    errors.position = "Enter valid whole-number X and Y coordinates.";
  }

  return errors;
}

export function toClickConfig(settings: ClickitySettings): ClickConfig {
  return {
    intervalMs: intervalInMilliseconds(settings),
    button: settings.button,
    repeat:
      settings.repeatMode === "count"
        ? { mode: "count", clicks: settings.repeatCount }
        : { mode: "untilStopped" },
    position:
      settings.positionMode === "fixed"
        ? { mode: "fixed", x: settings.x, y: settings.y }
        : { mode: "current" },
  };
}

export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "Not set";
  if (milliseconds < 1_000) return `${milliseconds} ms`;

  const units: Array<[number, string]> = [
    [3_600_000, "hour"],
    [60_000, "minute"],
    [1_000, "second"],
  ];
  let remaining = milliseconds;
  const parts: string[] = [];

  for (const [size, label] of units) {
    const amount = Math.floor(remaining / size);
    if (amount > 0) {
      parts.push(`${amount} ${label}${amount === 1 ? "" : "s"}`);
      remaining %= size;
    }
    if (parts.length === 2) break;
  }

  if (remaining > 0 && parts.length < 2) parts.push(`${remaining} ms`);
  return parts.join(" ");
}
