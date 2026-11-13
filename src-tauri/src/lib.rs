#[cfg(desktop)]
use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  AppHandle, Manager, WindowEvent,
};

#[cfg(desktop)]
const MAIN_WINDOW: &str = "main";

#[cfg(desktop)]
fn show_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
  }
}

#[cfg(desktop)]
fn create_tray(app: &tauri::App) -> tauri::Result<()> {
  let open = MenuItem::with_id(app, "open", "Abrir Stormpad", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&open, &quit])?;

  TrayIconBuilder::new()
    .icon(app.default_window_icon().cloned().expect("bundle icon missing"))
    .tooltip("Stormpad")
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| match event.id.as_ref() {
      "open" => show_main_window(app),
      "quit" => app.exit(0),
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
        show_main_window(tray.app_handle());
      }
    })
    .build(app)?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default();

  // Registered first so launching the app again focuses the instance hiding in the tray instead of opening a second one.
  #[cfg(desktop)]
  let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main_window(app)));

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      #[cfg(desktop)]
      create_tray(app)?;
      Ok(())
    })
    .on_window_event(|_window, _event| {
      // Closing the window only hides it; the app keeps running (and syncing) until "Sair" in the tray menu.
      #[cfg(desktop)]
      if let WindowEvent::CloseRequested { api, .. } = _event {
        api.prevent_close();
        let _ = _window.hide();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
