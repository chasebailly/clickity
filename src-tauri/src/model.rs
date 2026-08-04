use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ClickButton {
    Left,
    Middle,
    Right,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "mode", rename_all = "camelCase")]
pub enum RepeatMode {
    Count { clicks: u64 },
    UntilStopped,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "mode", rename_all = "camelCase")]
pub enum PositionMode {
    Current,
    Fixed { x: i32, y: i32 },
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClickConfig {
    pub interval_ms: u64,
    pub button: ClickButton,
    pub repeat: RepeatMode,
    pub position: PositionMode,
}

impl Default for ClickConfig {
    fn default() -> Self {
        Self {
            interval_ms: 1_000,
            button: ClickButton::Left,
            repeat: RepeatMode::Count { clicks: 10 },
            position: PositionMode::Current,
        }
    }
}

impl ClickConfig {
    pub fn validate(&self) -> Result<(), String> {
        if self.interval_ms == 0 {
            return Err("Set an interval greater than 0 milliseconds.".into());
        }

        if let RepeatMode::Count { clicks } = self.repeat {
            if clicks == 0 {
                return Err("The number of clicks must be at least 1.".into());
            }
        }

        Ok(())
    }

    pub fn target_clicks(&self) -> Option<u64> {
        match self.repeat {
            RepeatMode::Count { clicks } => Some(clicks),
            RepeatMode::UntilStopped => None,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RunPhase {
    Idle,
    Running,
    Error,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSnapshot {
    pub phase: RunPhase,
    pub clicks_completed: u64,
    pub target_clicks: Option<u64>,
    pub interval_ms: u64,
    pub message: Option<String>,
}

impl Default for RuntimeSnapshot {
    fn default() -> Self {
        Self {
            phase: RunPhase::Idle,
            clicks_completed: 0,
            target_clicks: Some(10),
            interval_ms: 1_000,
            message: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CursorPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub os: String,
    pub session_type: Option<String>,
    pub wayland_warning: bool,
}

impl PlatformInfo {
    pub fn detect() -> Self {
        let session_type = std::env::var("XDG_SESSION_TYPE")
            .ok()
            .map(|value| value.to_lowercase());

        Self {
            os: std::env::consts::OS.to_string(),
            wayland_warning: cfg!(target_os = "linux")
                && session_type.as_deref() == Some("wayland"),
            session_type,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_configuration_is_safe_and_valid() {
        let config = ClickConfig::default();
        assert_eq!(config.interval_ms, 1_000);
        assert_eq!(config.target_clicks(), Some(10));
        assert!(config.validate().is_ok());
    }

    #[test]
    fn zero_interval_is_rejected() {
        let config = ClickConfig {
            interval_ms: 0,
            ..ClickConfig::default()
        };
        assert!(config.validate().is_err());
    }

    #[test]
    fn zero_repeat_count_is_rejected() {
        let config = ClickConfig {
            repeat: RepeatMode::Count { clicks: 0 },
            ..ClickConfig::default()
        };
        assert!(config.validate().is_err());
    }

    #[test]
    fn until_stopped_has_no_target() {
        let config = ClickConfig {
            repeat: RepeatMode::UntilStopped,
            ..ClickConfig::default()
        };
        assert_eq!(config.target_clicks(), None);
    }
}
