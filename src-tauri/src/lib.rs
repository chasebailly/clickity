mod engine;
mod model;

use engine::{ClickEngine, MouseDriver, SystemMouse};
use model::{ClickConfig, CursorPosition, PlatformInfo, RuntimeSnapshot};
use serde::Serialize;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

const DEFAULT_RUN_SHORTCUT: &str = "F6";
const DEFAULT_CAPTURE_SHORTCUT: &str = "F7";
const POSITION_CAPTURE_EVENT: &str = "position-capture-result";

struct AppState {
    engine: ClickEngine,
    hotkey: Mutex<String>,
    hotkey_registered: AtomicBool,
    hotkey_error: Mutex<Option<String>>,
    hotkey_down: AtomicBool,
    capture_hotkey: Mutex<String>,
    capture_hotkey_registered: AtomicBool,
    capture_hotkey_error: Mutex<Option<String>>,
    capture_hotkey_down: AtomicBool,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            engine: ClickEngine::default(),
            hotkey: Mutex::new(DEFAULT_RUN_SHORTCUT.into()),
            hotkey_registered: AtomicBool::new(false),
            hotkey_error: Mutex::new(None),
            hotkey_down: AtomicBool::new(false),
            capture_hotkey: Mutex::new(DEFAULT_CAPTURE_SHORTCUT.into()),
            capture_hotkey_registered: AtomicBool::new(false),
            capture_hotkey_error: Mutex::new(None),
            capture_hotkey_down: AtomicBool::new(false),
        }
    }
}

/// Two accelerators collide when they parse to the same key combination.
fn shortcuts_conflict(left: &str, right: &str) -> bool {
    match (left.parse::<Shortcut>(), right.parse::<Shortcut>()) {
        (Ok(left), Ok(right)) => left == right,
        _ => left.eq_ignore_ascii_case(right),
    }
}

/// Registers `accelerator` for one binding, releasing whatever it held before.
fn rebind_shortcut(
    app: &AppHandle,
    accelerator: &str,
    slot: &Mutex<String>,
    registered: &AtomicBool,
) -> Result<(), String> {
    let mut current = slot.lock().map_err(|_| "Shortcut state is unavailable")?;
    let already_registered = registered.load(Ordering::Relaxed);

    if already_registered && current.as_str() == accelerator {
        return Ok(());
    }

    app.global_shortcut()
        .register(accelerator)
        .map_err(|error| format!("That shortcut could not be registered: {error}"))?;

    if already_registered {
        if let Err(error) = app.global_shortcut().unregister(current.as_str()) {
            let _ = app.global_shortcut().unregister(accelerator);
            return Err(format!("Could not replace the existing shortcut: {error}"));
        }
    }

    *current = accelerator.to_string();
    registered.store(true, Ordering::Relaxed);
    Ok(())
}

/// Reads one accelerator without holding its lock, so the two setters cannot deadlock.
fn read_accelerator(slot: &Mutex<String>) -> Result<String, String> {
    let guard = slot.lock().map_err(|_| "Shortcut state is unavailable")?;
    Ok(guard.clone())
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PositionCaptureResult {
    position: Option<CursorPosition>,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InitialState {
    runtime: RuntimeSnapshot,
    hotkey: String,
    hotkey_registered: bool,
    hotkey_error: Option<String>,
    capture_hotkey: String,
    capture_hotkey_error: Option<String>,
    platform: PlatformInfo,
}

#[tauri::command]
fn get_initial_state(state: State<'_, AppState>) -> InitialState {
    InitialState {
        runtime: state.engine.snapshot(),
        hotkey: state
            .hotkey
            .lock()
            .map(|hotkey| hotkey.clone())
            .unwrap_or_else(|_| DEFAULT_RUN_SHORTCUT.into()),
        hotkey_registered: state.hotkey_registered.load(Ordering::Relaxed),
        hotkey_error: state
            .hotkey_error
            .lock()
            .ok()
            .and_then(|error| error.clone()),
        capture_hotkey: state
            .capture_hotkey
            .lock()
            .map(|hotkey| hotkey.clone())
            .unwrap_or_else(|_| DEFAULT_CAPTURE_SHORTCUT.into()),
        capture_hotkey_error: state
            .capture_hotkey_error
            .lock()
            .ok()
            .and_then(|error| error.clone()),
        platform: PlatformInfo::detect(),
    }
}

#[tauri::command]
fn update_config(config: ClickConfig, state: State<'_, AppState>) -> Result<(), String> {
    state.engine.update_config(config)
}

#[tauri::command]
fn start_clicking(
    app: AppHandle,
    config: ClickConfig,
    state: State<'_, AppState>,
) -> Result<RuntimeSnapshot, String> {
    state.engine.update_config(config)?;
    state.engine.start(app)
}

#[tauri::command]
fn stop_clicking(app: AppHandle, state: State<'_, AppState>) -> RuntimeSnapshot {
    state.engine.stop(&app)
}

#[tauri::command]
fn set_hotkey(
    app: AppHandle,
    accelerator: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let accelerator = accelerator.trim();
    if accelerator.is_empty() {
        return Err("Choose a keyboard shortcut.".into());
    }

    let capture = read_accelerator(&state.capture_hotkey)?;
    if shortcuts_conflict(accelerator, &capture) {
        return Err(format!("{capture} is already used for position capture."));
    }

    rebind_shortcut(&app, accelerator, &state.hotkey, &state.hotkey_registered)?;
    if let Ok(mut error) = state.hotkey_error.lock() {
        *error = None;
    }
    Ok(())
}

#[tauri::command]
fn set_capture_hotkey(
    app: AppHandle,
    accelerator: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let accelerator = accelerator.trim();
    if accelerator.is_empty() {
        return Err("Choose a keyboard shortcut.".into());
    }

    let run = read_accelerator(&state.hotkey)?;
    if shortcuts_conflict(accelerator, &run) {
        return Err(format!("{run} is already used to start and stop clicking."));
    }

    rebind_shortcut(
        &app,
        accelerator,
        &state.capture_hotkey,
        &state.capture_hotkey_registered,
    )?;
    if let Ok(mut error) = state.capture_hotkey_error.lock() {
        *error = None;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    let state = app.state::<AppState>();

                    // The capture shortcut stays registered for the whole session:
                    // pressing it captures the pointer immediately, with no arming step.
                    let is_capture = state
                        .capture_hotkey
                        .lock()
                        .ok()
                        .and_then(|value| value.parse::<Shortcut>().ok())
                        .is_some_and(|parsed| parsed == *shortcut);

                    if is_capture {
                        match event.state() {
                            ShortcutState::Pressed => {
                                let first_press =
                                    !state.capture_hotkey_down.swap(true, Ordering::Relaxed);
                                // Settings are locked mid-run, so ignore capture then.
                                if first_press && !state.engine.is_running() {
                                    let result = SystemMouse::new().and_then(|mouse| {
                                        mouse.location().map(|(x, y)| CursorPosition { x, y })
                                    });
                                    let payload = match result {
                                        Ok(position) => PositionCaptureResult {
                                            position: Some(position),
                                            error: None,
                                        },
                                        Err(error) => PositionCaptureResult {
                                            position: None,
                                            error: Some(error),
                                        },
                                    };
                                    let _ = app.emit(POSITION_CAPTURE_EVENT, payload);
                                }
                            }
                            ShortcutState::Released => {
                                state.capture_hotkey_down.store(false, Ordering::Relaxed);
                            }
                        }
                        return;
                    }

                    match event.state() {
                        ShortcutState::Pressed => {
                            if !state.hotkey_down.swap(true, Ordering::Relaxed) {
                                state.engine.toggle(app.clone());
                            }
                        }
                        ShortcutState::Released => {
                            state.hotkey_down.store(false, Ordering::Relaxed);
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            let state = app.state::<AppState>();
            match app.global_shortcut().register(DEFAULT_RUN_SHORTCUT) {
                Ok(()) => state.hotkey_registered.store(true, Ordering::Relaxed),
                Err(error) => {
                    if let Ok(mut stored_error) = state.hotkey_error.lock() {
                        *stored_error = Some(format!(
                            "{DEFAULT_RUN_SHORTCUT} could not be registered. Choose another shortcut: {error}"
                        ));
                    }
                }
            }

            match app.global_shortcut().register(DEFAULT_CAPTURE_SHORTCUT) {
                Ok(()) => state
                    .capture_hotkey_registered
                    .store(true, Ordering::Relaxed),
                Err(error) => {
                    if let Ok(mut stored_error) = state.capture_hotkey_error.lock() {
                        *stored_error = Some(format!(
                            "{DEFAULT_CAPTURE_SHORTCUT} could not be registered. Choose another shortcut: {error}"
                        ));
                    }
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Destroyed) {
                let state = window.state::<AppState>();
                state.engine.stop(window.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_initial_state,
            update_config,
            start_clicking,
            stop_clicking,
            set_hotkey,
            set_capture_hotkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Clickity");
}
