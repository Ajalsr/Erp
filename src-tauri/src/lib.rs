use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Single-instance MUST be first in the chain (its own docs) — on Windows/
    // Linux a click on a spifora:// link spawns a NEW process; this plugin
    // intercepts that, forwards argv to the ALREADY-running instance, and (via
    // the "deep-link" feature) automatically calls
    // DeepLink::handle_cli_arguments so the same "deep-link://new-url" event
    // fires as it would natively on macOS — one JS listener covers every OS.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // AppImage/dev builds aren't registered by an installer, so the OS
            // doesn't know to route spifora:// links here without this — makes
            // the scheme work immediately after `cargo tauri dev` too. Release
            // Windows/macOS builds get registered by the bundler (NSIS/DMG)
            // from the `plugins.deep-link.desktop.schemes` config instead.
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                app.deep_link().register_all()?;
            }

            // No backend sidecar here on purpose — the app talks to the hosted
            // api.spifora.com over HTTPS (see Frontend/.env.production) instead
            // of bundling a local Go binary with production secrets baked in.
            // See scripts/build-backend.js for why that used to exist and why
            // it doesn't anymore.
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
