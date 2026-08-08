import "@fontsource-variable/manrope";
import "@fontsource-variable/roboto-condensed";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
const capturePositionButton = byId<HTMLButtonElement>("capture-position");
const changeHotkeyButton = byId<HTMLButtonElement>("change-hotkey");
const hotkeyDisplay = byId<HTMLElement>("hotkey-display");
const actionHotkey = byId<HTMLElement>("action-hotkey");
const actionButton = byId<HTMLButtonElement>("action-button");
const actionLabel = byId<HTMLElement>("action-label");
const statusPill = byId<HTMLElement>("status-pill");
const statusLabel = byId<HTMLElement>("status-label");
const intervalSummary = byId<HTMLElement>("interval-summary");
const intervalError = byId<HTMLElement>("interval-error");
const repeatError = byId<HTMLElement>("repeat-error");
const positionError = byId<HTMLElement>("position-error");
const captureHelp = byId<HTMLElement>("capture-help");
const hotkeyError = byId<HTMLElement>("hotkey-error");
const hotkeyCaptureCopy = byId<HTMLElement>("hotkey-capture-copy");
const runTitle = byId<HTMLElement>("run-title");
const runDetail = byId<HTMLElement>("run-detail");
const liveRegion = byId<HTMLElement>("live-region");

const settingControls = Array.from(
  document.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
    "[data-setting]",
  ),
);

let settings = loadSettings();
let hotkeyAccelerator = settings.hotkey;
let hotkeyLabel = settings.hotkeyDisplay;
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
let captureInProgress = false;
let positionCaptureError = "";
let hotkeyCaptureInProgress = false;
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
    hotkey: hotkeyAccelerator,
    hotkeyDisplay: hotkeyLabel,
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
  hotkeyAccelerator = nextSettings.hotkey;
  hotkeyLabel = nextSettings.hotkeyDisplay;
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
  return (
    runtime.phase === "running" ||
    startCountdownId !== null ||
    captureInProgress
  );
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
  capturePositionButton.disabled = (locked && !captureInProgress) || !fixedMode;

  if (hotkeyCaptureInProgress) changeHotkeyButton.disabled = false;
}

function runtimePhase(): "idle" | "starting" | "capturing" | "running" | "error" {
  if (captureInProgress) return "capturing";
  return startCountdownId !== null ? "starting" : runtime.phase;
}

function renderRuntime(): void {
  const phase = runtimePhase();
  statusPill.dataset.phase = phase;
  statusLabel.textContent =
    phase === "starting"
      ? "Starting"
      : phase === "capturing"
        ? "Capturing position"
      : phase === "running"
        ? "Running"
        : phase === "error"
          ? "Needs attention"
          : "Idle";

  actionButton.classList.toggle("stop-button", phase === "running");
  actionButton.classList.toggle("cancel-button", phase === "starting");
  actionButton.dataset.phase = phase;

  if (phase === "capturing") {
    actionLabel.textContent = "Start clicking";
    runTitle.textContent = "Position capture armed";
    runDetail.textContent = "Move the pointer, then press F7.";
  } else if (phase === "starting") {
    actionLabel.textContent = "Cancel start";
    runTitle.textContent = `Starting in ${countdownRemaining}…`;
    runDetail.textContent = "Move the pointer to where you want Clickity to begin.";
  } else if (phase === "running") {
    actionLabel.textContent = "Stop clicking";
    runTitle.textContent = runtime.targetClicks
      ? `${runtime.clicksCompleted} of ${runtime.targetClicks} clicks`
      : `${runtime.clicksCompleted} click${runtime.clicksCompleted === 1 ? "" : "s"}`;
    runDetail.textContent = `Running every ${formatDuration(runtime.intervalMs)}.`;
  } else if (phase === "error") {
    actionLabel.textContent = "Try again";
    runTitle.textContent = "Clickity stopped";
    runDetail.textContent = runtime.message ?? "Check the settings and try again.";
  } else {
    actionLabel.textContent = "Start clicking";
    if (runtime.message) {
      runTitle.textContent = runtime.message;
      runDetail.textContent = "Ready for another run.";
    } else {
      runTitle.textContent = "Ready when you are";
      runDetail.textContent = "The first click happens after one interval.";
    }
  }

  hotkeyDisplay.textContent = hotkeyCaptureInProgress ? "…" : hotkeyLabel;
  actionHotkey.textContent = hotkeyLabel;
  capturePositionButton.querySelector("span")!.textContent = captureInProgress
    ? "Cancel capture"
    : "Capture";
  capturePositionButton.setAttribute(
    "aria-pressed",
    String(captureInProgress),
  );
  captureHelp.innerHTML = captureInProgress
    ? "Capture armed. Move the pointer, then press <kbd>F7</kbd>."
    : "Select Capture, move the pointer, then press <kbd>F7</kbd>.";
  const errors = validateSettings(settings);
  actionButton.disabled =
    captureInProgress ||
    (phase !== "running" && phase !== "starting" && hasErrors(errors));
  renderControlAvailability();
}

function renderAll(): void {
  const errors = validateSettings(settings);
  renderValidation(errors);
  renderRuntime();
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

async function restoreAppWindow(): Promise<string | null> {
  const appWindow = getCurrentWindow();
  let visible = false;
  try {
    await appWindow.unminimize();
    visible = true;
  } catch {
    // Continue: show() can still recover a window when unminimize is unsupported.
  }
  try {
    await appWindow.show();
    visible = true;
  } catch {
    // Report below if neither restoration path succeeded.
  }

  if (!visible) {
    return "Clickity could not restore its window. Reopen it from the taskbar; the captured coordinates were saved.";
  }

  try {
    await appWindow.setFocus();
  } catch {
    return "Clickity restored, but your desktop prevented it from taking focus. Select it from the taskbar; the captured coordinates were saved.";
  }
  return null;
}

async function finishPositionCapture(
  result: PositionCaptureResult,
): Promise<void> {
  if (!captureInProgress) return;
  captureInProgress = false;

  let releaseError = "";
  if (isTauri) {
    try {
      await invoke("cancel_position_capture");
    } catch (error) {
      releaseError = errorMessage(error);
    }
  }

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
    positionCaptureError = result.error ?? "The pointer position could not be captured.";
    announce(positionCaptureError);
  }

  if (releaseError) {
    positionCaptureError = positionCaptureError
      ? `${positionCaptureError} ${releaseError}`
      : releaseError;
  }

  const restorationError = await restoreAppWindow();
  if (restorationError) {
    positionCaptureError = positionCaptureError
      ? `${positionCaptureError} ${restorationError}`
      : restorationError;
    announce(positionCaptureError);
  }
  renderAll();
}

async function beginPositionCapture(): Promise<void> {
  if (!isTauri) {
    positionCaptureError = "Position capture is unavailable in browser preview mode.";
    renderAll();
    return;
  }

  try {
    positionCaptureError = "";
    await invoke("begin_position_capture");
    captureInProgress = true;
    announce("Position capture armed. Move the pointer, then press F7.");
    renderAll();
    await getCurrentWindow().minimize();
  } catch (error) {
    captureInProgress = false;
    let releaseError = "";
    try {
      await invoke("cancel_position_capture");
    } catch (cancelError) {
      releaseError = ` ${errorMessage(cancelError)}`;
    }
    positionCaptureError = `${errorMessage(error)}${releaseError}`;
    announce(positionCaptureError);
    renderAll();
  }
}

async function cancelPositionCapture(): Promise<void> {
  if (!captureInProgress) return;
  captureInProgress = false;
  if (isTauri) {
    try {
      await invoke("cancel_position_capture");
    } catch (error) {
      positionCaptureError = errorMessage(error);
    }
  }
  const restorationError = await restoreAppWindow();
  if (restorationError) positionCaptureError = restorationError;
  announce("Position capture cancelled.");
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
  if (!hotkeyCaptureInProgress || event.repeat) return;
  if (event.key === "Escape") {
    event.preventDefault();
    endHotkeyCapture();
    changeHotkeyButton.focus();
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
    hotkeyError.textContent = "Use a modifier combination or a function key.";
    announce(hotkeyError.textContent);
    return;
  }

  const accelerator = [...modifiers, token].join("+");
  if (accelerator === "F7") {
    hotkeyError.textContent = "F7 is reserved for position capture.";
    hotkeyCaptureCopy.textContent = "Press another shortcut · Esc to cancel";
    announce(hotkeyError.textContent);
    return;
  }
  hotkeyCaptureCopy.textContent = "Registering shortcut…";
  try {
    if (!isTauri) throw new Error("Shortcuts are unavailable in browser preview mode.");
    await invoke("set_hotkey", { accelerator });
    hotkeyAccelerator = accelerator;
    hotkeyLabel = displayForShortcut(accelerator);
    settings = { ...readForm(), hotkey: accelerator, hotkeyDisplay: hotkeyLabel };
    saveSettings(settings);
    hotkeyError.textContent = "";
    endHotkeyCapture();
    announce(`Shortcut changed to ${hotkeyLabel}.`);
  } catch (error) {
    hotkeyError.textContent = errorMessage(error);
    hotkeyCaptureCopy.textContent = "Press another shortcut · Esc to cancel";
    announce(hotkeyError.textContent);
  }
  renderRuntime();
}

function beginHotkeyCapture(): void {
  if (controlsAreLocked()) return;
  hotkeyCaptureInProgress = true;
  changeHotkeyButton.textContent = "Cancel";
  changeHotkeyButton.setAttribute("aria-pressed", "true");
  hotkeyCaptureCopy.textContent = "Press a shortcut · Esc to cancel";
  hotkeyError.textContent = "";
  window.addEventListener("keydown", handleHotkeyCapture, true);
  renderRuntime();
}

function endHotkeyCapture(): void {
  hotkeyCaptureInProgress = false;
  changeHotkeyButton.textContent = "Change";
  changeHotkeyButton.removeAttribute("aria-pressed");
  hotkeyCaptureCopy.textContent = "";
  window.removeEventListener("keydown", handleHotkeyCapture, true);
  renderRuntime();
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
      (event) => void finishPositionCapture(event.payload),
    );
    const initial = await invoke<InitialState>("get_initial_state");
    runtime = initial.runtime;

    try {
      await invoke("set_hotkey", { accelerator: hotkeyAccelerator });
      hotkeyLabel = displayForShortcut(hotkeyAccelerator);
      hotkeyError.textContent = "";
    } catch (error) {
      hotkeyAccelerator = initial.hotkey;
      hotkeyLabel = displayForShortcut(initial.hotkey);
      hotkeyError.textContent = initial.hotkeyError ?? errorMessage(error);
    }

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

capturePositionButton.addEventListener("click", () => {
  if (captureInProgress) void cancelPositionCapture();
  else void beginPositionCapture();
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

changeHotkeyButton.addEventListener("click", () => {
  if (hotkeyCaptureInProgress) endHotkeyCapture();
  else beginHotkeyCapture();
});

window.addEventListener("beforeunload", () => {
  if (unlistenRuntime) unlistenRuntime();
  if (unlistenPositionCapture) unlistenPositionCapture();
  if (captureInProgress && isTauri) void invoke("cancel_position_capture");
});

void initializeNative();
