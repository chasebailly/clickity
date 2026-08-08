import "@fontsource-variable/manrope";
import "@fontsource-variable/roboto-condensed";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import {
  formatDuration,
  intervalInMilliseconds,
  loadSettings,
  saveSettings,
  toClickConfig,
  validateSettings,
} from "./settings";
import type {
  ClickConfig,
  ClickitySettings,
  InitialState,
  PositionCaptureResult,
  RuntimeSnapshot,
  ValidationErrors,
} from "./types";

const isTauri = "__TAURI_INTERNALS__" in window;

// @tauri-apps/api does not export ResizeDirection, so derive it from the method.
type ResizeDirection = Parameters<
  ReturnType<typeof getCurrentWindow>["startResizeDragging"]
>[0];

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

const form = byId<HTMLFormElement>("click-form");
const hoursInput = byId<HTMLInputElement>("hours");
const minutesInput = byId<HTMLInputElement>("minutes");
const secondsInput = byId<HTMLInputElement>("seconds");
const millisecondsInput = byId<HTMLInputElement>("milliseconds");
const repeatCountInput = byId<HTMLInputElement>("repeat-count");
const positionXInput = byId<HTMLInputElement>("position-x");
const positionYInput = byId<HTMLInputElement>("position-y");
const coordinateRow = byId<HTMLElement>("coordinate-row");
const titlebar = byId<HTMLElement>("titlebar");
const appShell = byId<HTMLElement>("app-shell");
const captureHelp = byId<HTMLElement>("capture-help");
const settingsDialog = byId<HTMLDialogElement>("settings-dialog");
const actionHotkey = byId<HTMLElement>("action-hotkey");
const actionButton = byId<HTMLButtonElement>("action-button");
const actionLabel = byId<HTMLElement>("action-label");
const statusPill = byId<HTMLElement>("status-pill");
const statusLabel = byId<HTMLElement>("status-label");
const intervalSummary = byId<HTMLElement>("interval-summary");
const intervalError = byId<HTMLElement>("interval-error");
const repeatError = byId<HTMLElement>("repeat-error");
const positionError = byId<HTMLElement>("position-error");
const runTitle = byId<HTMLElement>("run-title");
const runDetail = byId<HTMLElement>("run-detail");
const liveRegion = byId<HTMLElement>("live-region");

const settingControls = Array.from(
  document.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
    "[data-setting]",
  ),
);

let settings = loadSettings();

// Both global shortcuts are rebindable and behave identically, so they share
// one capture flow; only the backend command and the DOM nodes differ.
interface ShortcutBinding {
  command: "set_hotkey" | "set_capture_hotkey";
  name: string;
  button: HTMLButtonElement;
  display: HTMLElement;
  error: HTMLElement;
  copy: HTMLElement;
  accelerator: string;
  label: string;
}

const runShortcut: ShortcutBinding = {
  command: "set_hotkey",
  name: "Start / stop shortcut",
  button: byId<HTMLButtonElement>("change-hotkey"),
  display: byId<HTMLElement>("hotkey-display"),
  error: byId<HTMLElement>("hotkey-error"),
  copy: byId<HTMLElement>("hotkey-capture-copy"),
  accelerator: settings.hotkey,
  label: settings.hotkeyDisplay,
};

const captureShortcut: ShortcutBinding = {
  command: "set_capture_hotkey",
  name: "Capture position shortcut",
  button: byId<HTMLButtonElement>("change-capture-hotkey"),
  display: byId<HTMLElement>("capture-hotkey-display"),
  error: byId<HTMLElement>("capture-hotkey-error"),
  copy: byId<HTMLElement>("capture-hotkey-capture-copy"),
  accelerator: settings.captureHotkey,
  label: settings.captureHotkeyDisplay,
};

const shortcutBindings = [runShortcut, captureShortcut];

let runtime: RuntimeSnapshot = {
  phase: "idle",
  clicksCompleted: 0,
  targetClicks: settings.repeatMode === "count" ? settings.repeatCount : null,
  intervalMs: intervalInMilliseconds(settings),
  message: null,
};
let startCountdownId: number | null = null;
let countdownRemaining = 0;
let countdownConfig: ClickConfig | null = null;
let positionCaptureError = "";
let activeShortcutBinding: ShortcutBinding | null = null;
let showValidation = false;
let syncTimer: number | null = null;
let unlistenRuntime: UnlistenFn | null = null;
let unlistenPositionCapture: UnlistenFn | null = null;

function selectedValue(name: string): string {
  return (
    document.querySelector<HTMLInputElement>(
      `input[name="${name}"]:checked`,
    )?.value ?? ""
  );
}

function setSelectedValue(name: string, value: string): void {
  const input = document.querySelector<HTMLInputElement>(
    `input[name="${name}"][value="${value}"]`,
  );
  if (input) input.checked = true;
}

function numericValue(input: HTMLInputElement): number {
  return input.value.trim() === "" ? Number.NaN : input.valueAsNumber;
}

function readForm(): ClickitySettings {
  return {
    hours: numericValue(hoursInput),
    minutes: numericValue(minutesInput),
    seconds: numericValue(secondsInput),
    milliseconds: numericValue(millisecondsInput),
    button: selectedValue("button") as ClickitySettings["button"],
    repeatMode: selectedValue(
      "repeat-mode",
    ) as ClickitySettings["repeatMode"],
    repeatCount: numericValue(repeatCountInput),
    positionMode: selectedValue(
      "position-mode",
    ) as ClickitySettings["positionMode"],
    x: numericValue(positionXInput),
    y: numericValue(positionYInput),
    hotkey: runShortcut.accelerator,
    hotkeyDisplay: runShortcut.label,
    captureHotkey: captureShortcut.accelerator,
    captureHotkeyDisplay: captureShortcut.label,
  };
}

function populateForm(nextSettings: ClickitySettings): void {
  hoursInput.value = String(nextSettings.hours);
  minutesInput.value = String(nextSettings.minutes);
  secondsInput.value = String(nextSettings.seconds);
  millisecondsInput.value = String(nextSettings.milliseconds);
  repeatCountInput.value = String(nextSettings.repeatCount);
  positionXInput.value = String(nextSettings.x);
  positionYInput.value = String(nextSettings.y);
  setSelectedValue("button", nextSettings.button);
  setSelectedValue("repeat-mode", nextSettings.repeatMode);
  setSelectedValue("position-mode", nextSettings.positionMode);
  runShortcut.accelerator = nextSettings.hotkey;
  runShortcut.label = nextSettings.hotkeyDisplay;
  captureShortcut.accelerator = nextSettings.captureHotkey;
  captureShortcut.label = nextSettings.captureHotkeyDisplay;
}

function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

function renderValidation(errors: ValidationErrors): void {
  intervalError.textContent = showValidation ? (errors.interval ?? "") : "";
  repeatError.textContent = showValidation ? (errors.repeat ?? "") : "";
  positionError.textContent =
    positionCaptureError || (showValidation ? (errors.position ?? "") : "");

  const interval = intervalInMilliseconds(settings);
  intervalSummary.textContent = errors.interval
    ? "Check interval"
    : `Every ${formatDuration(interval)}`;
}

function controlsAreLocked(): boolean {
  return runtime.phase === "running" || startCountdownId !== null;
}

function renderControlAvailability(): void {
  const locked = controlsAreLocked();
  for (const control of settingControls) control.disabled = locked;

  const countMode = settings.repeatMode === "count";
  repeatCountInput.disabled = locked || !countMode;

  const fixedMode = settings.positionMode === "fixed";
  coordinateRow.dataset.visible = String(fixedMode);
  positionXInput.disabled = locked || !fixedMode;
  positionYInput.disabled = locked || !fixedMode;

  // The active binding keeps its button live so the capture can be cancelled.
  for (const binding of shortcutBindings) {
    binding.button.disabled = locked && binding !== activeShortcutBinding;
  }
}

function runtimePhase(): "idle" | "starting" | "running" | "error" {
  return startCountdownId !== null ? "starting" : runtime.phase;
}

function renderRuntime(): void {
  const phase = runtimePhase();
  statusPill.dataset.phase = phase;
  statusLabel.textContent =
    phase === "starting"
      ? "Starting"
      : phase === "running"
        ? "Running"
        : phase === "error"
          ? "Needs attention"
          : "Idle";

  actionButton.classList.toggle("stop-button", phase === "running");
  actionButton.classList.toggle("cancel-button", phase === "starting");
  actionButton.dataset.phase = phase;

  // Only the error phase carries a detail line now.
  runDetail.textContent = "";

  if (phase === "starting") {
    actionLabel.textContent = "Cancel start";
    runTitle.textContent = `Starting in ${countdownRemaining}…`;
  } else if (phase === "running") {
    actionLabel.textContent = "Stop clicking";
    runTitle.textContent = runtime.targetClicks
      ? `${runtime.clicksCompleted} of ${runtime.targetClicks} clicks`
      : `${runtime.clicksCompleted} click${runtime.clicksCompleted === 1 ? "" : "s"}`;
  } else if (phase === "error") {
    actionLabel.textContent = "Try again";
    runTitle.textContent = "Clickity stopped";
    runDetail.textContent = runtime.message ?? "Check the settings and try again.";
  } else {
    actionLabel.textContent = "Start clicking";
    runTitle.textContent = runtime.message ?? "Ready when you are";
  }

  for (const binding of shortcutBindings) {
    binding.display.textContent =
      binding === activeShortcutBinding ? "…" : binding.label;
  }
  actionHotkey.textContent = runShortcut.label;

  const captureKey = document.createElement("kbd");
  captureKey.textContent = captureShortcut.label;
  captureHelp.textContent = "Move the pointer anywhere, then press ";
  captureHelp.append(captureKey, " to capture it.");
  const errors = validateSettings(settings);
  actionButton.disabled =
    phase !== "running" && phase !== "starting" && hasErrors(errors);
  renderControlAvailability();
}

// The window hugs its content, so no dead space sits below the action bar. The
// content grows and shrinks (coordinate row, error lines), hence refitting here
// rather than shipping one fixed height.
function fitWindowHeight(): void {
  if (!isTauri) return;
  const target = Math.ceil(titlebar.offsetHeight + appShell.offsetHeight);
  if (!target || Math.abs(target - window.innerHeight) < 2) return;
  void getCurrentWindow().setSize(new LogicalSize(window.innerWidth, target));
}

function renderAll(): void {
  const errors = validateSettings(settings);
  renderValidation(errors);
  renderRuntime();
  fitWindowHeight();
}

function announce(message: string): void {
  liveRegion.textContent = "";
  window.setTimeout(() => {
    liveRegion.textContent = message;
  }, 20);
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function setLocalError(message: string): void {
  runtime = {
    ...runtime,
    phase: "error",
    message,
  };
  announce(message);
  renderRuntime();
}

function applyRuntime(nextRuntime: RuntimeSnapshot): void {
  if (startCountdownId !== null) clearStartCountdown(false);
  const previousPhase = runtime.phase;
  const previousMessage = runtime.message;
  runtime = nextRuntime;
  if (
    nextRuntime.message &&
    (nextRuntime.message !== previousMessage || nextRuntime.phase !== previousPhase)
  ) {
    announce(nextRuntime.message);
  }
  renderRuntime();
}

function queueConfigSync(): void {
  if (!isTauri || controlsAreLocked()) return;
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(async () => {
    syncTimer = null;
    const errors = validateSettings(settings);
    if (hasErrors(errors)) return;
    try {
      await invoke("update_config", { config: toClickConfig(settings) });
    } catch (error) {
      setLocalError(errorMessage(error));
    }
  }, 120);
}

function updateFromForm(): void {
  settings = readForm();
  const errors = validateSettings(settings);
  if (!hasErrors(errors)) {
    saveSettings(settings);
    if (runtime.phase === "error") {
      runtime = { ...runtime, phase: "idle", message: null };
    }
    queueConfigSync();
  }
  renderAll();
}

async function startClicking(config: ClickConfig): Promise<void> {
  if (!isTauri) {
    setLocalError("Native clicking is unavailable in browser preview mode.");
    return;
  }

  try {
    const snapshot = await invoke<RuntimeSnapshot>("start_clicking", { config });
    applyRuntime(snapshot);
  } catch (error) {
    setLocalError(errorMessage(error));
  }
}

async function stopClicking(): Promise<void> {
  if (!isTauri) return;
  try {
    const snapshot = await invoke<RuntimeSnapshot>("stop_clicking");
    applyRuntime(snapshot);
  } catch (error) {
    setLocalError(errorMessage(error));
  }
}

function clearStartCountdown(render = true): void {
  if (startCountdownId !== null) window.clearInterval(startCountdownId);
  startCountdownId = null;
  countdownRemaining = 0;
  countdownConfig = null;
  if (render) {
    announce("Start cancelled");
    renderRuntime();
  }
}

function beginStartCountdown(config: ClickConfig): void {
  runtime = { ...runtime, phase: "idle", message: null };
  countdownRemaining = 3;
  countdownConfig = config;
  startCountdownId = window.setInterval(() => {
    countdownRemaining -= 1;
    if (countdownRemaining <= 0) {
      const pendingConfig = countdownConfig;
      clearStartCountdown(false);
      renderRuntime();
      if (pendingConfig) void startClicking(pendingConfig);
      return;
    }
    announce(`Starting in ${countdownRemaining}`);
    renderRuntime();
  }, 1_000);
  announce("Starting in 3");
  renderRuntime();
}

async function handleAction(): Promise<void> {
  if (runtime.phase === "running") {
    await stopClicking();
    return;
  }

  if (startCountdownId !== null) {
    clearStartCountdown();
    return;
  }

  settings = readForm();
  const errors = validateSettings(settings);
  showValidation = true;
  renderAll();
  if (hasErrors(errors)) {
    announce("Please correct the highlighted settings.");
    return;
  }

  saveSettings(settings);
  const config = toClickConfig(settings);
  if (settings.positionMode === "current") {
    beginStartCountdown(config);
  } else {
    await startClicking(config);
  }
}

// F7 is always live, so this fires whenever the user presses it, with no arming.
function applyPositionCapture(result: PositionCaptureResult): void {
  if (result.position) {
    positionXInput.value = String(result.position.x);
    positionYInput.value = String(result.position.y);
    positionCaptureError = "";
    settings = readForm();
    saveSettings(settings);
    queueConfigSync();
    announce(
      `Position captured at X ${result.position.x}, Y ${result.position.y}.`,
    );
  } else {
    positionCaptureError =
      result.error ?? "The pointer position could not be captured.";
    announce(positionCaptureError);
  }
  renderAll();
}

function displayForShortcut(accelerator: string): string {
  const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  return accelerator
    .split("+")
    .map((part) => {
      if (part === "CmdOrCtrl") return mac ? "⌘" : "Ctrl";
      if (part === "Command") return "⌘";
      if (part === "Control") return mac ? "⌃" : "Ctrl";
      if (part === "Alt") return mac ? "⌥" : "Alt";
      if (part === "Shift") return mac ? "⇧" : "Shift";
      if (part === "Space") return "Space";
      return part;
    })
    .join(mac ? "" : " + ");
}

function keyToken(event: KeyboardEvent): string | null {
  if (/^F([1-9]|1\d|2[0-4])$/.test(event.key)) return event.key;
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
  if (/^Digit\d$/.test(event.code)) return event.code.slice(5);

  const specialKeys: Record<string, string> = {
    " ": "Space",
    Enter: "Enter",
    Tab: "Tab",
    ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Insert: "Insert",
  };
  return specialKeys[event.key] ?? null;
}

async function handleHotkeyCapture(event: KeyboardEvent): Promise<void> {
  const binding = activeShortcutBinding;
  if (!binding || event.repeat) return;
  if (event.key === "Escape") {
    event.preventDefault();
    endHotkeyCapture();
    binding.button.focus();
    return;
  }

  const token = keyToken(event);
  if (!token) return;
  event.preventDefault();
  event.stopPropagation();

  const modifiers: string[] = [];
  if (event.metaKey || event.ctrlKey) modifiers.push("CmdOrCtrl");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");

  const functionKey = token.startsWith("F") && /^F\d+$/.test(token);
  if (!functionKey && modifiers.length === 0) {
    binding.error.textContent = "Use a modifier combination or a function key.";
    announce(binding.error.textContent);
    return;
  }

  const accelerator = [...modifiers, token].join("+");
  const other = binding === runShortcut ? captureShortcut : runShortcut;
  if (accelerator === other.accelerator) {
    binding.error.textContent = `${other.label} is already used for the ${other.name.toLowerCase()}.`;
    binding.copy.textContent = "Press another shortcut · Esc to cancel";
    announce(binding.error.textContent);
    return;
  }

  binding.copy.textContent = "Registering shortcut…";
  try {
    if (!isTauri) {
      throw new Error("Shortcuts are unavailable in browser preview mode.");
    }
    await invoke(binding.command, { accelerator });
    binding.accelerator = accelerator;
    binding.label = displayForShortcut(accelerator);
    settings = readForm();
    saveSettings(settings);
    binding.error.textContent = "";
    endHotkeyCapture();
    announce(`${binding.name} changed to ${binding.label}.`);
  } catch (error) {
    binding.error.textContent = errorMessage(error);
    binding.copy.textContent = "Press another shortcut · Esc to cancel";
    announce(binding.error.textContent);
  }
  renderRuntime();
}

function beginHotkeyCapture(binding: ShortcutBinding): void {
  if (controlsAreLocked()) return;
  if (activeShortcutBinding) endHotkeyCapture();
  activeShortcutBinding = binding;
  binding.button.textContent = "Cancel";
  binding.button.setAttribute("aria-pressed", "true");
  binding.copy.textContent = "Press a shortcut · Esc to cancel";
  binding.error.textContent = "";
  window.addEventListener("keydown", handleHotkeyCapture, true);
  renderRuntime();
}

function endHotkeyCapture(): void {
  const binding = activeShortcutBinding;
  if (!binding) return;
  activeShortcutBinding = null;
  binding.button.textContent = "Change";
  binding.button.removeAttribute("aria-pressed");
  binding.copy.textContent = "";
  window.removeEventListener("keydown", handleHotkeyCapture, true);
  renderRuntime();
}

/// Re-registers a saved shortcut, falling back to whatever the backend holds.
async function restoreShortcut(
  binding: ShortcutBinding,
  fallback: string,
  fallbackError: string | null,
): Promise<void> {
  try {
    await invoke(binding.command, { accelerator: binding.accelerator });
    binding.label = displayForShortcut(binding.accelerator);
    binding.error.textContent = "";
  } catch (error) {
    binding.accelerator = fallback;
    binding.label = displayForShortcut(fallback);
    binding.error.textContent = fallbackError ?? errorMessage(error);
  }
}

async function initializeNative(): Promise<void> {
  if (!isTauri) {
    renderAll();
    return;
  }

  try {
    unlistenRuntime = await listen<RuntimeSnapshot>(
      "runtime-state",
      (event) => applyRuntime(event.payload),
    );
    unlistenPositionCapture = await listen<PositionCaptureResult>(
      "position-capture-result",
      (event) => applyPositionCapture(event.payload),
    );
    const initial = await invoke<InitialState>("get_initial_state");
    runtime = initial.runtime;

    const desiredRun = runShortcut.accelerator;
    await restoreShortcut(runShortcut, initial.hotkey, initial.hotkeyError);
    await restoreShortcut(
      captureShortcut,
      initial.captureHotkey,
      initial.captureHotkeyError,
    );

    // A saved pair that swaps the two defaults loses the first pass, because the
    // backend still holds the old value. Retry once the other binding has moved.
    if (runShortcut.accelerator !== desiredRun) {
      runShortcut.accelerator = desiredRun;
      await restoreShortcut(runShortcut, initial.hotkey, initial.hotkeyError);
    }

    settings = readForm();
    saveSettings(settings);

    const errors = validateSettings(settings);
    if (!hasErrors(errors)) {
      await invoke("update_config", { config: toClickConfig(settings) });
    }
  } catch (error) {
    setLocalError(errorMessage(error));
  }
  renderAll();
}

populateForm(settings);
settings = readForm();
renderAll();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void handleAction();
});

form.addEventListener("input", (event) => {
  if ((event.target as HTMLElement).matches("[data-setting]")) {
    updateFromForm();
  }
});

form.addEventListener("change", (event) => {
  if ((event.target as HTMLElement).matches("[data-setting]")) {
    updateFromForm();
  }
});

form.addEventListener("focusout", (event) => {
  if ((event.target as HTMLElement).matches("input[type='number']")) {
    showValidation = true;
    updateFromForm();
  }
});

for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-step-target]",
)) {
  button.addEventListener("click", () => {
    const input = byId<HTMLInputElement>(button.dataset.stepTarget ?? "");
    if (button.dataset.step === "-1") input.stepDown();
    else input.stepUp();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

for (const binding of shortcutBindings) {
  binding.button.addEventListener("click", () => {
    if (activeShortcutBinding === binding) endHotkeyCapture();
    else beginHotkeyCapture(binding);
  });
}

byId<HTMLButtonElement>("open-settings").addEventListener("click", () => {
  settingsDialog.showModal();
});

byId<HTMLButtonElement>("close-settings").addEventListener("click", () => {
  settingsDialog.close();
});

// Backdrop clicks land on the dialog element itself.
settingsDialog.addEventListener("click", (event) => {
  if (event.target === settingsDialog) settingsDialog.close();
});

settingsDialog.addEventListener("close", () => {
  endHotkeyCapture();
});

window.addEventListener("beforeunload", () => {
  if (unlistenRuntime) unlistenRuntime();
  if (unlistenPositionCapture) unlistenPositionCapture();
});

// The window is undecorated, so the titlebar below replaces the native one.
byId<HTMLButtonElement>("window-minimize").addEventListener("click", () => {
  void getCurrentWindow().minimize();
});

byId<HTMLButtonElement>("window-maximize").addEventListener("click", () => {
  void getCurrentWindow().toggleMaximize();
});

byId<HTMLButtonElement>("window-close").addEventListener("click", () => {
  void getCurrentWindow().close();
});

for (const handle of document.querySelectorAll<HTMLElement>("[data-resize]")) {
  handle.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    void getCurrentWindow().startResizeDragging(
      handle.dataset.resize as ResizeDirection,
    );
  });
}

// Web fonts land after first paint and shift row heights, so refit once loaded.
void document.fonts.ready.then(fitWindowHeight);

void initializeNative();
