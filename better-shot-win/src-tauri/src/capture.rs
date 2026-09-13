use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::{ImageFormat, RgbaImage};
use std::io::Cursor;
use std::io::Write;
use std::process::{Child, Command as StdCommand, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use windows::Win32::Foundation::HANDLE;
use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC,
    GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS,
    SRCCOPY,
};
use windows::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
};
use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
use windows::Win32::UI::WindowsAndMessaging::{
    GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN,
    SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
};

pub struct RecordingState {
    pub process: Mutex<Option<Child>>,
    pub is_running: Arc<AtomicBool>,
    pub output_path: Mutex<Option<String>>,
    pub stderr_log: Mutex<Option<String>>,
}

#[derive(serde::Serialize)]
pub struct DisplayInfo {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

pub fn capture_screen_raw(x: i32, y: i32, width: i32, height: i32) -> Result<RgbaImage, String> {
    unsafe {
        let hdc_screen = GetDC(None);
        if hdc_screen.0.is_null() {
            return Err("Failed to get screen DC".to_string());
        }

        let hdc_mem = CreateCompatibleDC(Some(hdc_screen));
        if hdc_mem.0.is_null() {
            ReleaseDC(None, hdc_screen);
            return Err("Failed to create compatible DC".to_string());
        }

        let hbmp = CreateCompatibleBitmap(hdc_screen, width, height);
        if hbmp.0.is_null() {
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(None, hdc_screen);
            return Err("Failed to create compatible bitmap".to_string());
        }

        let old_bmp = SelectObject(hdc_mem, hbmp.into());

        let bitblt_res = BitBlt(hdc_mem, 0, 0, width, height, Some(hdc_screen), x, y, SRCCOPY);
        if bitblt_res.is_err() {
            SelectObject(hdc_mem, old_bmp);
            let _ = DeleteObject(hbmp.into());
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(None, hdc_screen);
            return Err("BitBlt screen capture failed".to_string());
        }

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: 0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [windows::Win32::Graphics::Gdi::RGBQUAD::default()],
        };

        let mut bgra_buf: Vec<u8> = vec![0; (width * height * 4) as usize];
        GetDIBits(
            hdc_mem,
            hbmp,
            0,
            height as u32,
            Some(bgra_buf.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        SelectObject(hdc_mem, old_bmp);
        let _ = DeleteObject(hbmp.into());
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(None, hdc_screen);

        let mut rgba_buf = bgra_buf;
        for chunk in rgba_buf.chunks_exact_mut(4) {
            let b = chunk[0];
            let r = chunk[2];
            chunk[0] = r;
            chunk[2] = b;
            chunk[3] = 255;
        }

        RgbaImage::from_raw(width as u32, height as u32, rgba_buf)
            .ok_or_else(|| "Failed to construct RgbaImage buffer".to_string())
    }
}

#[tauri::command]
pub fn get_virtual_screen_bounds() -> DisplayInfo {
    unsafe {
        let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        let width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
        let height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
        DisplayInfo { x, y, width, height }
    }
}

#[tauri::command]
pub fn capture_fullscreen(window: tauri::Window) -> Result<String, String> {
    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            let _ = windows::Win32::UI::WindowsAndMessaging::SetWindowDisplayAffinity(
                windows::Win32::Foundation::HWND(hwnd.0 as *mut _),
                windows::Win32::UI::WindowsAndMessaging::WDA_EXCLUDEFROMCAPTURE,
            );
        }
    }
    let bounds = get_virtual_screen_bounds();
    let img = capture_screen_raw(bounds.x, bounds.y, bounds.width, bounds.height)?;
    
    let mut bytes: Vec<u8> = Vec::new();
    let mut cursor = Cursor::new(&mut bytes);
    img.write_to(&mut cursor, ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    Ok(format!("data:image/png;base64,{}", BASE64.encode(&bytes)))
}

#[tauri::command]
pub fn capture_region(window: tauri::Window, x: i32, y: i32, width: i32, height: i32) -> Result<String, String> {
    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            let _ = windows::Win32::UI::WindowsAndMessaging::SetWindowDisplayAffinity(
                windows::Win32::Foundation::HWND(hwnd.0 as *mut _),
                windows::Win32::UI::WindowsAndMessaging::WDA_EXCLUDEFROMCAPTURE,
            );
        }
    }
    if width <= 0 || height <= 0 {
        return Err("Invalid region dimensions".to_string());
    }
    let img = capture_screen_raw(x, y, width, height)?;
    
    let mut bytes: Vec<u8> = Vec::new();
    let mut cursor = Cursor::new(&mut bytes);
    img.write_to(&mut cursor, ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    Ok(format!("data:image/png;base64,{}", BASE64.encode(&bytes)))
}

#[tauri::command]
pub fn copy_image_to_clipboard(base64_data: String) -> Result<(), String> {
    let clean_b64 = base64_data
        .strip_prefix("data:image/png;base64,")
        .unwrap_or(&base64_data);
    
    let png_bytes = BASE64.decode(clean_b64).map_err(|e| e.to_string())?;
    let img = image::load_from_memory(&png_bytes).map_err(|e| e.to_string())?.to_rgba8();

    let width = img.width() as i32;
    let height = img.height() as i32;

    unsafe {
        let header_size = std::mem::size_of::<BITMAPINFOHEADER>();
        let data_size = (width * height * 4) as usize;
        let total_size = header_size + data_size;

        let h_mem = GlobalAlloc(GMEM_MOVEABLE, total_size).map_err(|e| e.to_string())?;
        let ptr = GlobalLock(h_mem) as *mut u8;
        if ptr.is_null() {
            return Err("GlobalLock failed".to_string());
        }

        let header = BITMAPINFOHEADER {
            biSize: header_size as u32,
            biWidth: width,
            biHeight: height,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: 0,
            biSizeImage: data_size as u32,
            biXPelsPerMeter: 0,
            biYPelsPerMeter: 0,
            biClrUsed: 0,
            biClrImportant: 0,
        };

        std::ptr::copy_nonoverlapping(
            &header as *const _ as *const u8,
            ptr,
            header_size,
        );

        let pixels_ptr = ptr.add(header_size);
        let raw_rgba = img.as_raw();

        for y_idx in 0..height {
            let src_y = (height - 1 - y_idx) as usize;
            let dst_y = y_idx as usize;
            for x_idx in 0..width as usize {
                let src_offset = (src_y * width as usize + x_idx) * 4;
                let dst_offset = (dst_y * width as usize + x_idx) * 4;

                let r = raw_rgba[src_offset];
                let g = raw_rgba[src_offset + 1];
                let b = raw_rgba[src_offset + 2];
                let a = raw_rgba[src_offset + 3];

                *pixels_ptr.add(dst_offset) = b;
                *pixels_ptr.add(dst_offset + 1) = g;
                *pixels_ptr.add(dst_offset + 2) = r;
                *pixels_ptr.add(dst_offset + 3) = a;
            }
        }

        GlobalUnlock(h_mem).ok();

        if OpenClipboard(None).is_ok() {
            let _ = EmptyClipboard();
            let _ = SetClipboardData(8, Some(HANDLE(h_mem.0)));
            let _ = CloseClipboard();
            Ok(())
        } else {
            Err("Failed to open Windows clipboard".to_string())
        }
    }
}

#[tauri::command]
pub fn save_image_to_disk(base64_data: String, target_path: String) -> Result<(), String> {
    let clean_b64 = base64_data
        .strip_prefix("data:image/png;base64,")
        .unwrap_or(&base64_data);
    let bytes = BASE64.decode(clean_b64).map_err(|e| e.to_string())?;
    std::fs::write(&target_path, bytes).map_err(|e| e.to_string())?;
    Ok(())
}

fn round_even(val: i32) -> i32 {
    let v = if val % 2 != 0 { val + 1 } else { val };
    if v < 2 { 2 } else { v }
}

// ─── High-Performance Screen Recording via GDI Frame Pipeline ────────────────

#[tauri::command]
pub fn start_screen_recording(
    window: tauri::Window,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    save_path: String,
    is_fullscreen: bool,
    state: tauri::State<'_, RecordingState>,
) -> Result<String, String> {
    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            let _ = windows::Win32::UI::WindowsAndMessaging::SetWindowDisplayAffinity(
                windows::Win32::Foundation::HWND(hwnd.0 as *mut _),
                windows::Win32::UI::WindowsAndMessaging::WDA_EXCLUDEFROMCAPTURE,
            );
        }
    }

    // Stop any previously running session
    state.is_running.store(false, Ordering::SeqCst);
    {
        let mut proc = state.process.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut child) = *proc {
            let _ = child.kill();
            let _ = child.wait();
        }
        *proc = None;
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    let clean_dir = save_path.trim_end_matches('\\').trim_end_matches('/');
    let _ = std::fs::create_dir_all(clean_dir);

    let output_file = format!("{}\\BetterShot_Record_{}.mp4", clean_dir, timestamp);

    let stderr_log_path = format!("{}\\BetterShot_ffmpeg_{}.log", std::env::temp_dir().display(), timestamp);
    let stderr_file = std::fs::File::create(&stderr_log_path)
        .map_err(|e| format!("Failed to create ffmpeg log: {}", e))?;

    // Determine target capture dimensions
    let (phys_x, phys_y, phys_w, phys_h) = if is_fullscreen || width <= 0 || height <= 0 {
        unsafe {
            let sw = GetSystemMetrics(SM_CXSCREEN);
            let sh = GetSystemMetrics(SM_CYSCREEN);
            (0, 0, round_even(sw), round_even(sh))
        }
    } else {
        (x, y, round_even(width), round_even(height))
    };

    let mut cmd = StdCommand::new("ffmpeg");

    cmd.arg("-f").arg("rawvideo")
        .arg("-pix_fmt").arg("bgra")
        .arg("-s").arg(format!("{}x{}", phys_w, phys_h))
        .arg("-r").arg("30")
        .arg("-i").arg("-")
        .arg("-c:v").arg("libx264")
        .arg("-preset").arg("ultrafast")
        .arg("-pix_fmt").arg("yuv420p")
        .arg("-y")
        .arg(&output_file);

    cmd.stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::from(stderr_file));

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "FFmpeg not found. Please install FFmpeg and add it to your system PATH.".to_string()
        } else {
            format!("Failed to start screen recording: {}", e)
        }
    })?;

    let mut stdin = child.stdin.take().ok_or_else(|| "Failed to capture ffmpeg stdin".to_string())?;

    state.is_running.store(true, Ordering::SeqCst);
    let is_running_clone = state.is_running.clone();

    // Spawn high-speed GDI frame capture thread
    std::thread::spawn(move || {
        let frame_interval = std::time::Duration::from_millis(33); // ~30 fps
        
        unsafe {
            let hdc_screen = GetDC(None);
            if hdc_screen.0.is_null() {
                return;
            }

            let hdc_mem = CreateCompatibleDC(Some(hdc_screen));
            if hdc_mem.0.is_null() {
                ReleaseDC(None, hdc_screen);
                return;
            }

            let hbmp = CreateCompatibleBitmap(hdc_screen, phys_w, phys_h);
            if hbmp.0.is_null() {
                let _ = DeleteDC(hdc_mem);
                ReleaseDC(None, hdc_screen);
                return;
            }

            let old_bmp = SelectObject(hdc_mem, hbmp.into());

            let mut bmi = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: phys_w,
                    biHeight: -phys_h, // top-down for BGRA rawvideo
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: 0,
                    biSizeImage: (phys_w * phys_h * 4) as u32,
                    biXPelsPerMeter: 0,
                    biYPelsPerMeter: 0,
                    biClrUsed: 0,
                    biClrImportant: 0,
                },
                bmiColors: [windows::Win32::Graphics::Gdi::RGBQUAD::default()],
            };

            let mut bgra_buf: Vec<u8> = vec![0; (phys_w * phys_h * 4) as usize];

            while is_running_clone.load(Ordering::SeqCst) {
                let start_time = std::time::Instant::now();

                let bitblt_ok = BitBlt(hdc_mem, 0, 0, phys_w, phys_h, Some(hdc_screen), phys_x, phys_y, SRCCOPY);
                if bitblt_ok.is_ok() {
                    // Draw active mouse cursor onto frame
                    let mut cursor_info = windows::Win32::UI::WindowsAndMessaging::CURSORINFO {
                        cbSize: std::mem::size_of::<windows::Win32::UI::WindowsAndMessaging::CURSORINFO>() as u32,
                        flags: windows::Win32::UI::WindowsAndMessaging::CURSORINFO_FLAGS(0),
                        hCursor: windows::Win32::UI::WindowsAndMessaging::HCURSOR(std::ptr::null_mut()),
                        ptScreenPos: windows::Win32::Foundation::POINT { x: 0, y: 0 },
                    };
                    if windows::Win32::UI::WindowsAndMessaging::GetCursorInfo(&mut cursor_info).is_ok()
                        && cursor_info.flags == windows::Win32::UI::WindowsAndMessaging::CURSOR_SHOWING
                    {
                        let mut icon_info = windows::Win32::UI::WindowsAndMessaging::ICONINFO::default();
                        if windows::Win32::UI::WindowsAndMessaging::GetIconInfo(
                            windows::Win32::UI::WindowsAndMessaging::HICON(cursor_info.hCursor.0),
                            &mut icon_info,
                        ).is_ok() {
                            let cursor_x = cursor_info.ptScreenPos.x - phys_x - icon_info.xHotspot as i32;
                            let cursor_y = cursor_info.ptScreenPos.y - phys_y - icon_info.yHotspot as i32;

                            let _ = windows::Win32::UI::WindowsAndMessaging::DrawIconEx(
                                hdc_mem,
                                cursor_x,
                                cursor_y,
                                windows::Win32::UI::WindowsAndMessaging::HICON(cursor_info.hCursor.0),
                                0,
                                0,
                                0,
                                None,
                                windows::Win32::UI::WindowsAndMessaging::DI_NORMAL,
                            );

                            if !icon_info.hbmMask.0.is_null() {
                                let _ = windows::Win32::Graphics::Gdi::DeleteObject(icon_info.hbmMask.into());
                            }
                            if !icon_info.hbmColor.0.is_null() {
                                let _ = windows::Win32::Graphics::Gdi::DeleteObject(icon_info.hbmColor.into());
                            }
                        }
                    }

                    GetDIBits(
                        hdc_mem,
                        hbmp,
                        0,
                        phys_h as u32,
                        Some(bgra_buf.as_mut_ptr() as *mut _),
                        &mut bmi,
                        DIB_RGB_COLORS,
                    );

                    if stdin.write_all(&bgra_buf).is_err() {
                        break;
                    }
                }

                let elapsed = start_time.elapsed();
                if elapsed < frame_interval {
                    std::thread::sleep(frame_interval - elapsed);
                }
            }

            let _ = stdin.flush();
            drop(stdin); // Closes ffmpeg stdin, finalizing the MP4 stream

            SelectObject(hdc_mem, old_bmp);
            let _ = DeleteObject(hbmp.into());
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(None, hdc_screen);
        }
    });

    {
        let mut proc = state.process.lock().map_err(|e| e.to_string())?;
        *proc = Some(child);
    }

    {
        let mut path = state.output_path.lock().map_err(|e| e.to_string())?;
        *path = Some(output_file.clone());
    }

    {
        let mut log = state.stderr_log.lock().map_err(|e| e.to_string())?;
        *log = Some(stderr_log_path.clone());
    }

    eprintln!("[BetterShot] Screen recording active → {}", output_file);
    Ok(output_file)
}

#[tauri::command]
pub fn stop_screen_recording(
    state: tauri::State<'_, RecordingState>,
) -> Result<String, String> {
    // 1. Signal capture thread to stop feeding frames and close stdin
    state.is_running.store(false, Ordering::SeqCst);

    let output = {
        let path = state.output_path.lock().map_err(|e| e.to_string())?;
        path.clone().unwrap_or_default()
    };

    if output.is_empty() {
        return Err("No active recording session".to_string());
    }

    let mut proc = state.process.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut child) = *proc {
        // Wait up to 6 seconds for ffmpeg to finish writing the MP4 file
        for _ in 0..12 {
            std::thread::sleep(std::time::Duration::from_millis(500));
            match child.try_wait() {
                Ok(Some(_)) => break,
                _ => {}
            }
        }

        // Force-terminate if it hasn't exited
        match child.try_wait() {
            Ok(Some(_)) => {}
            _ => {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    } else {
        *proc = None;
        if let Ok(mut path) = state.output_path.lock() {
            *path = None;
        }
        return Err("Recording process was not found".to_string());
    }

    *proc = None;

    if let Ok(mut path) = state.output_path.lock() {
        *path = None;
    }

    if let Ok(mut log) = state.stderr_log.lock() {
        if let Some(ref log_path) = *log {
            let _ = std::fs::remove_file(log_path);
        }
        *log = None;
    }

    // Give filesystem a moment to flush file handles
    std::thread::sleep(std::time::Duration::from_millis(200));

    match std::fs::metadata(&output) {
        Ok(meta) if meta.len() > 0 => {
            eprintln!("[BetterShot] Video successfully recorded ({} bytes) → {}", meta.len(), output);
            Ok(output)
        }
        Ok(_) => {
            let _ = std::fs::remove_file(&output);
            Err("Recording produced 0 bytes. Check FFmpeg installation.".to_string())
        }
        Err(_) => {
            Err("Recording output file was not created. Check FFmpeg installation.".to_string())
        }
    }
}

#[tauri::command]
pub fn check_recording_alive(
    state: tauri::State<'_, RecordingState>,
) -> Result<bool, String> {
    if !state.is_running.load(Ordering::SeqCst) {
        return Ok(false);
    }
    let mut proc = state.process.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut child) = *proc {
        match child.try_wait() {
            Ok(Some(_)) => {
                *proc = None;
                state.is_running.store(false, Ordering::SeqCst);
                Ok(false)
            }
            Ok(None) => Ok(true),
            Err(_) => Ok(false),
        }
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn select_folder() -> Result<Option<String>, String> {
    let output = StdCommand::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select File Destination'; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }",
        ])
        .output()
        .map_err(|e| e.to_string())?;

    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        Ok(None)
    } else {
        Ok(Some(path))
    }
}

#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    StdCommand::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn show_in_folder(path: String) -> Result<(), String> {
    StdCommand::new("explorer")
        .arg(format!("/select,{}", path))
        .spawn()
        .map_err(|e| format!("Failed to reveal in folder: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    if std::path::Path::new(&path).exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    Ok(())
}
