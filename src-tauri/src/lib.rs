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
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, ShortcutState};

const CAPTURE_SHORTCUT: &str = "F7";
const POSITION_CAPTURE_EVENT: &str = "position-capture-result";

struct AppState {
    engine: ClickEngine,
    hotkey: Mutex<String>,
    hotkey_registered: AtomicBool,
    hotkey_error: Mutex<Option<String>>,
    hotkey_down: AtomicBool,
    capture_active: AtomicBool,
    capture_hotkey_registered: AtomicBool,
    capture_hotkey_down: AtomicBool,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            engine: ClickEngine::default(),
            hotkey: Mutex::new("F6".into()),
            hotkey_registered: AtomicBool::new(false),
            hotkey_error: Mutex::new(None),
            hotkey_down: AtomicBool::new(false),
            capture_active: AtomicBool::new(false),
            capture_hotkey_registered: AtomicBool::new(false),
            capture_hotkey_down: AtomicBool::new(false),
        }
    }
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
            .unwrap_or_else(|_| "F6".into()),
        hotkey_registered: state.hotkey_registered.load(Ordering::Relaxed),
        hotkey_error: state
            .hotkey_error
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
    if state.capture_active.load(Ordering::Relaxed) {
        return Err("Finish or cancel position capture before starting Clickity.".into());
    }
    state.engine.update_config(config)?;
    state.engine.start(app)
}

#[tauri::command]
fn stop_clicking(app: AppHandle, state: State<'_, AppState>) -> RuntimeSnapshot {
    state.engine.stop(&app)
}

#[tauri::command]
fn begin_position_capture(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if state.engine.is_running() {
        return Err("Stop Clickity before capturing a position.".into());
    }

    if !state.capture_hotkey_registered.load(Ordering::Relaxed) {
        app.global_shortcut()
            .register(CAPTURE_SHORTCUT)
            .map_err(|error| format!("F7 could not be registered for position capture: {error}"))?;
        state
            .capture_hotkey_registered
            .store(true, Ordering::Relaxed);
    }

    state.capture_hotkey_down.store(false, Ordering::Relaxed);
    state.capture_active.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
fn cancel_position_capture(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.capture_active.store(false, Ordering::Relaxed);
    state.capture_hotkey_down.store(false, Ordering::Relaxed);
    if state.capture_hotkey_registered.load(Ordering::Relaxed) {
        app.global_shortcut()
            .unregister(CAPTURE_SHORTCUT)
            .map_err(|error| format!("F7 could not be released after position capture: {error}"))?;
        state
            .capture_hotkey_registered
            .store(false, Ordering::Relaxed);
    }
    Ok(())
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
    if accelerator.eq_ignore_ascii_case(CAPTURE_SHORTCUT) {
        return Err("F7 is reserved for position capture.".into());
    }

    let mut current = state
        .hotkey
        .lock()
        .map_err(|_| "Shortcut state is unavailable")?;
    let already_registered = state.hotkey_registered.load(Ordering::Relaxed);

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
    state.hotkey_registered.store(true, Ordering::Relaxed);
    if let Ok(mut error) = state.hotkey_error.lock() {
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

                    if shortcut.matches(Modifiers::empty(), Code::F7) {
                        match event.state() {
                            ShortcutState::Pressed => {
                                let first_press =
                                    !state.capture_hotkey_down.swap(true, Ordering::Relaxed);
                                if first_press
                                    && state.capture_active.swap(false, Ordering::Relaxed)
                                {
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

                    if state.capture_active.load(Ordering::Relaxed) {
                        if event.state() == ShortcutState::Released {
                            state.hotkey_down.store(false, Ordering::Relaxed);
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
            match app.global_shortcut().register("F6") {
                Ok(()) => state.hotkey_registered.store(true, Ordering::Relaxed),
                Err(error) => {
                    if let Ok(mut stored_error) = state.hotkey_error.lock() {
                        *stored_error = Some(format!(
                            "F6 could not be registered. Choose another shortcut: {error}"
                        ));
                    }
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Destroyed) {
                let state = window.state::<AppState>();
                state.capture_active.store(false, Ordering::Relaxed);
                state.engine.stop(window.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_initial_state,
            update_config,
            start_clicking,
            stop_clicking,
            begin_position_capture,
            cancel_position_capture,
            set_hotkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Clickity");
}
