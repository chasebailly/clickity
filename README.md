<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/grid.svg?title=Clickity&amp;subtitle=Clicks%2C+right+on+cue.&amp;logo=tauri&amp;align=center&amp;theme=violet&amp;mode=dark" />
    <img src="https://shieldcn.dev/header/grid.svg?title=Clickity&amp;subtitle=Clicks%2C+right+on+cue.&amp;logo=tauri&amp;align=center&amp;theme=violet&amp;mode=light" alt="Clickity — Clicks, right on cue." />
  </picture>
</p>

<p align="center">
  A lightweight desktop autoclicker with precise timing, flexible targeting, and a global start/stop shortcut.
</p>

<p align="center">
  <a href="package.json"><img src="https://shieldcn.dev/badge/version-0.1.0-7c3aed.svg?variant=secondary&amp;logo=false" alt="Version 0.1.0" /></a>
  <a href="https://v2.tauri.app/"><img src="https://shieldcn.dev/badge/Tauri-2-24c8db.svg?variant=secondary&amp;logo=tauri" alt="Built with Tauri 2" /></a>
  <a href="https://github.com/chasebailly/clickity/stargazers"><img src="https://shieldcn.dev/github/stars/chasebailly/clickity.svg?variant=secondary" alt="GitHub stars" /></a>
  <a href="https://github.com/chasebailly/clickity/commits/main"><img src="https://shieldcn.dev/github/last-commit/chasebailly/clickity.svg?variant=secondary" alt="Last commit" /></a>
  <a href="LICENSE"><img src="https://shieldcn.dev/badge/license-MIT-22c55e.svg?variant=secondary&amp;logo=false" alt="MIT license" /></a>
</p>

Clickity is a small, cross-platform desktop app built with Tauri 2, vanilla TypeScript, and Rust. It uses the operating system's webview instead of shipping an entire browser runtime, while Rust handles timing, global shortcuts, and native mouse input.

> [!IMPORTANT]
> Clickity generates real mouse input. Test new configurations somewhere harmless, keep the stop shortcut in mind, and only use automation where you have permission.

## Features

- **Precise intervals** — combine hours, minutes, seconds, and milliseconds.
- **Any mouse button** — automate left, middle, or right clicks.
- **Flexible repeat modes** — run for an exact count or until you stop it.
- **Two targeting modes** — follow the live cursor or return to fixed X/Y coordinates for every click.
- **Position capture** — start a three-second countdown, move the pointer, and save its coordinates.
- **Global control** — start or stop Clickity from any application with a configurable shortcut (`F6` by default).
- **Persistent preferences** — restore your last configuration on launch while always starting safely in an idle state.
- **Responsive cancellation** — stop immediately, even while waiting through a long interval.
- **Clear feedback** — see inline validation, live click progress, platform notices, and native errors.

## Getting started

Clickity does not have packaged downloads yet. Run it from source with the steps below.

### Prerequisites

- [Bun](https://bun.sh/) or Node.js 18+
- A current stable [Rust toolchain](https://www.rust-lang.org/tools/install)
- The [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system

On Debian or Ubuntu, install the native dependencies with:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev libxkbcommon-dev libxdo-dev
```

Clone the repository, install dependencies, and launch the desktop app:

```bash
git clone https://github.com/chasebailly/clickity.git
cd clickity
bun install
bun run tauri dev
```

If you prefer npm, replace the last two commands with `npm install` and `npm run tauri dev`.

## Using Clickity

1. Set how long Clickity should wait between clicks.
2. Choose the mouse button and either a click count or **Until stopped**.
3. Select **Follow cursor** or enter a **Fixed position**. Use **Capture** to record the pointer's coordinates after a three-second countdown.
4. Select **Start clicking** or press the global shortcut. Press the shortcut again—or select **Stop clicking**—to stop.

The first click occurs after one complete interval. Starting **Follow cursor** from the window adds a three-second countdown so you can move away from the Start button; starting with the global shortcut begins immediately.

## Platform support

| Platform | Status | Notes |
| --- | --- | --- |
| Windows | Supported | A normally launched app cannot click inside applications running as administrator. Mixed-DPI, multi-monitor setups should be verified manually. |
| macOS | Supported | Grant Clickity **Accessibility** permission when macOS asks so it can synthesize mouse input. |
| Linux (X11) | Supported | Clickity currently uses the X11 input backend. |
| Linux (Wayland) | Experimental | Synthetic input and global shortcuts depend on the compositor; Clickity displays a compatibility warning. |

Very short intervals are best-effort on every platform. Operating-system scheduling means Clickity cannot provide hard real-time guarantees.

## Development

The main project commands are:

| Command | Purpose |
| --- | --- |
| `bun run tauri dev` | Run the desktop app with frontend hot reload |
| `bun run build` | Type-check and build the web frontend |
| `bun run check` | Build the frontend and run `cargo check` |
| `bun run test` | Run the Rust test suite with a fake mouse driver |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | Lint the Rust code |
| `bun run tauri build` | Produce a release bundle for the current platform |

Release artifacts are written to `src-tauri/target/release/bundle/`. Build on each target operating system; production Windows and macOS releases should also be signed, with macOS builds notarized.

## How it works

The TypeScript frontend owns the form, local settings, validation, countdowns, and status display. The Rust backend owns configuration validation, global shortcut registration, cursor access, click scheduling, cancellation, and native input simulation.

The click loop waits on an interruptible channel instead of sleeping. That design keeps **Stop** responsive even when the configured interval is several hours. Rust tests use a fake mouse driver and never generate real input.

## Project structure

```text
clickity/
├── src/                 # TypeScript UI, settings, styles, and shared types
├── src-tauri/
│   ├── src/             # Rust commands, click engine, and data model
│   ├── capabilities/    # Tauri permissions
│   └── tauri.conf.json  # Window, bundle, and build configuration
├── index.html           # Application shell
└── package.json         # Frontend dependencies and project scripts
```

## Contributing

Bug reports and focused pull requests are welcome. Before opening a pull request, run:

```bash
bun run check
bun run test
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Changes involving native input should be tested on every affected operating system. Keep automated tests behind the fake mouse driver so the test suite never clicks the user's desktop.

## License

Clickity is available under the [MIT License](LICENSE).
