mod capture;

use capture::{
    capture_fullscreen, capture_region, check_recording_alive, close_app_window,
    copy_image_to_clipboard, delete_file, drag_window, generate_video_thumbnail,
    get_virtual_screen_bounds, open_file, save_image_to_disk, select_folder,
    set_window_mode, show_in_folder, start_screen_recording, stop_screen_recording,
    RecordingState,
};
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Exclude the BetterShot window from all screen captures and recordings
            for (_, window) in app.webview_windows() {
                if let Ok(hwnd) = window.hwnd() {
                    unsafe {
                        let _ = SetWindowDisplayAffinity(HWND(hwnd.0 as *mut _), WDA_EXCLUDEFROMCAPTURE);
                    }
                }
            }
            Ok(())
        })
        .manage(RecordingState {
            process: Mutex::new(None),
            is_running: Arc::new(AtomicBool::new(false)),
            output_path: Mutex::new(None),
            raw_video_path: Mutex::new(None),
            stderr_log: Mutex::new(None),
            sys_audio_path: Mutex::new(None),
            mic_audio_path: Mutex::new(None),
            sys_wav_writer: Arc::new(Mutex::new(None)),
            mic_wav_writer: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            get_virtual_screen_bounds,
            capture_fullscreen,
            capture_region,
            copy_image_to_clipboard,
            save_image_to_disk,
            select_folder,
            start_screen_recording,
            stop_screen_recording,
            generate_video_thumbnail,
            check_recording_alive,
            open_file,
            show_in_folder,
            delete_file,
            set_window_mode,
            close_app_window,
            drag_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
