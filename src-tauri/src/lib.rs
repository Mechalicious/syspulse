mod system_monitor;

use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    auto_run_on_boot: bool,
    hide_on_system_tray_when_auto_run_on_boot: bool,
    minimize_app_to_system_tray_at_close: bool,
    floating_system_information_window: bool,
    language: String,
    temperature_display: String,
    theme: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_run_on_boot: false,
            hide_on_system_tray_when_auto_run_on_boot: false,
            minimize_app_to_system_tray_at_close: true,
            floating_system_information_window: false,
            language: "fr".to_string(),
            temperature_display: "celsius".to_string(),
            theme: "dark".to_string(),
        }
    }
}

#[derive(Default)]
struct AppState {
    settings: Mutex<AppSettings>,
}

fn settings_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Impossible de récupérer le dossier de configuration: {e}"))?;
    fs::create_dir_all(&config_dir).map_err(|e| format!("Impossible de créer le dossier de configuration: {e}"))?;
    Ok(config_dir.join("settings.json"))
}

fn load_settings_from_disk(app: &AppHandle) -> AppSettings {
    let Ok(path) = settings_path(app) else {
        return AppSettings::default();
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return AppSettings::default();
    };
    serde_json::from_str::<AppSettings>(&raw).unwrap_or_default()
}

fn save_settings_to_disk(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Impossible de sérialiser les paramètres: {e}"))?;
    fs::write(path, json).map_err(|e| format!("Impossible d'écrire les paramètres: {e}"))
}

fn apply_floating_window(app: &AppHandle, enabled: bool) -> Result<(), String> {
    if enabled {
        if app.get_webview_window("floating").is_none() {
            WebviewWindowBuilder::new(
                app,
                "floating",
                WebviewUrl::App("index.html?view=floating".into()),
            )
            .title("SysPulse Floating")
            .always_on_top(true)
            .decorations(false)
            .resizable(false)
            .inner_size(320.0, 170.0)
            .build()
            .map_err(|e| format!("Impossible d'ouvrir la fenêtre flottante: {e}"))?;
        }
    } else if let Some(window) = app.get_webview_window("floating") {
        let _ = window.close();
    }
    Ok(())
}

fn apply_runtime_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    if settings.auto_run_on_boot {
        app.autolaunch()
            .enable()
            .map_err(|e| format!("Activation auto-run impossible: {e}"))?;
    } else {
        if let Err(error) = app.autolaunch().disable() {
            let message = error.to_string().to_ascii_lowercase();
            let is_not_found = message.contains("os error 2")
                || message.contains("not found")
                || message.contains("introuvable");
            if !is_not_found {
                return Err(format!("Désactivation auto-run impossible: {error}"));
            }
        }
    }

    apply_floating_window(app, settings.floating_system_information_window)
}

fn setup_tray(app: &AppHandle) -> Result<(), String> {
    let show_item = MenuItem::with_id(app, "show", "Afficher", true, None::<&str>)
        .map_err(|e| format!("Création du menu tray impossible: {e}"))?;
    let quit_item = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)
        .map_err(|e| format!("Création du menu tray impossible: {e}"))?;

    let menu = Menu::with_items(app, &[&show_item, &quit_item])
        .map_err(|e| format!("Création du menu tray impossible: {e}"))?;

    let tray_icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "Aucune icône par défaut disponible pour le tray".to_string())?;

    TrayIconBuilder::with_id("main")
        .icon(tray_icon)
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)
        .map_err(|e| format!("Initialisation tray impossible: {e}"))?;

    Ok(())
}

#[tauri::command]
fn kill_process(pid: u32) -> Result<(), String> {
    system_monitor::kill_process_by_pid(pid)
}

#[tauri::command]
fn get_app_settings(state: State<AppState>) -> Result<AppSettings, String> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| "Impossible d'accéder aux paramètres".to_string())?
        .clone();
    Ok(settings)
}

#[tauri::command]
async fn update_app_settings(app: AppHandle, state: State<'_, AppState>, settings: AppSettings) -> Result<(), String> {
    save_settings_to_disk(&app, &settings)?;
    {
        let mut guard = state
            .settings
            .lock()
            .map_err(|_| "Impossible de mettre à jour les paramètres".to_string())?;
        *guard = settings.clone();
    }
    apply_runtime_settings(&app, &settings)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![kill_process, get_app_settings, update_app_settings])
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.app_handle().state::<AppState>();
                let should_hide = state
                    .settings
                    .lock()
                    .map(|settings| settings.minimize_app_to_system_tray_at_close)
                    .unwrap_or(false);
                if should_hide {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            let loaded = load_settings_from_disk(&app.handle());
            {
                let state = app.state::<AppState>();
                let _ = state.settings.lock().map(|mut guard| {
                    *guard = loaded.clone();
                });
            }

            setup_tray(&app.handle())?;
            apply_runtime_settings(&app.handle(), &loaded)?;

            if loaded.auto_run_on_boot && loaded.hide_on_system_tray_when_auto_run_on_boot {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            system_monitor::start(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
