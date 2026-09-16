use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use image::{ImageFormat, RgbaImage};
use std::io::Cursor;
use std::io::Write;
use std::process::{Child, Command as StdCommand, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{sync_channel, Receiver, SyncSender, TrySendError};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use windows::Win32::Foundation::HANDLE;
use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC,
    GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, CAPTUREBLT,
    DIB_RGB_COLORS, ROP_CODE, SRCCOPY,
};
use windows::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
};
use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
use windows::Win32::UI::WindowsAndMessaging::{
    GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN,
    SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
};

pub struct WavWriter {
    file: std::fs::File,
    data_bytes_written: u32,
    sample_rate: u32,
    channels: u16,
}

impl WavWriter {
    pub fn create(path: &str, sample_rate: u32, channels: u16) -> Result<Self, String> {
        let mut file = std::fs::File::create(path).map_err(|e| e.to_string())?;
        let header = [0u8; 44];
        file.write_all(&header).map_err(|e| e.to_string())?;
        Ok(Self {
            file,
            data_bytes_written: 0,
            sample_rate,
            channels,
        })
    }

    pub fn write_samples_f32(&mut self, samples: &[f32]) -> Result<(), String> {
        let mut buf = Vec::with_capacity(samples.len() * 2);
        for &s in samples {
            let clamped = s.clamp(-1.0, 1.0);
            let val = (clamped * 32767.0) as i16;
            buf.extend_from_slice(&val.to_le_bytes());
        }
        self.file.write_all(&buf).map_err(|e| e.to_string())?;
        self.data_bytes_written += buf.len() as u32;
        Ok(())
    }

    pub fn write_samples_i16(&mut self, samples: &[i16]) -> Result<(), String> {
        let mut buf = Vec::with_capacity(samples.len() * 2);
        for &s in samples {
            buf.extend_from_slice(&s.to_le_bytes());
        }
        self.file.write_all(&buf).map_err(|e| e.to_string())?;
        self.data_bytes_written += buf.len() as u32;
        Ok(())
    }

    pub fn finalize(&mut self) -> Result<(), String> {
        use std::io::Seek;
        use std::io::SeekFrom;

        let total_file_size = 44 + self.data_bytes_written;
        let riff_chunk_size = if total_file_size >= 8 { total_file_size - 8 } else { 0 };
        let byte_rate = self.sample_rate * (self.channels as u32) * 2;
        let block_align = self.channels * 2;

        let mut header = [0u8; 44];
        header[0..4].copy_from_slice(b"RIFF");
        header[4..8].copy_from_slice(&riff_chunk_size.to_le_bytes());
        header[8..12].copy_from_slice(b"WAVE");
        header[12..16].copy_from_slice(b"fmt ");
        header[16..20].copy_from_slice(&16u32.to_le_bytes());
        header[20..22].copy_from_slice(&1u16.to_le_bytes());
        header[22..24].copy_from_slice(&self.channels.to_le_bytes());
        header[24..28].copy_from_slice(&self.sample_rate.to_le_bytes());
        header[28..32].copy_from_slice(&byte_rate.to_le_bytes());
        header[32..34].copy_from_slice(&block_align.to_le_bytes());
        header[34..36].copy_from_slice(&16u16.to_le_bytes());
        header[36..40].copy_from_slice(b"data");
        header[40..44].copy_from_slice(&self.data_bytes_written.to_le_bytes());

        self.file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
        self.file.write_all(&header).map_err(|e| e.to_string())?;
        self.file.flush().map_err(|e| e.to_string())?;
        Ok(())
    }
}

pub struct RecordingState {
    pub process: Mutex<Option<Child>>,
    pub is_running: Arc<AtomicBool>,
    pub output_path: Mutex<Option<String>>,
    pub raw_video_path: Mutex<Option<String>>,
    pub stderr_log: Mutex<Option<String>>,
    pub sys_audio_path: Mutex<Option<String>>,
    pub mic_audio_path: Mutex<Option<String>>,
    pub sys_wav_writer: Arc<Mutex<Option<WavWriter>>>,
    pub mic_wav_writer: Arc<Mutex<Option<WavWriter>>>,
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

        let bitblt_res = BitBlt(hdc_mem, 0, 0, width, height, Some(hdc_screen), x, y, ROP_CODE(SRCCOPY.0 | CAPTUREBLT.0));
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

// ─── High-Performance Screen Recording via Decoupled Zero-Alloc Pipeline ────

struct CursorCache {
    last_handle: isize,
    hotspot_x: i32,
    hotspot_y: i32,
}

impl Default for CursorCache {
    fn default() -> Self {
        Self {
            last_handle: -1,
            hotspot_x: 0,
            hotspot_y: 0,
        }
    }
}

fn spawn_system_audio_capture_thread(
    is_running: Arc<AtomicBool>,
    wav_writer: Arc<Mutex<Option<WavWriter>>>,
) {
    std::thread::spawn(move || {
        let host = cpal::default_host();
        let device = match host.default_output_device() {
            Some(d) => d,
            None => {
                eprintln!("[BetterShot Audio] No default output device found for system audio loopback");
                return;
            }
        };

        let config = match device.default_output_config() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[BetterShot Audio] Failed to get default output config: {}", e);
                return;
            }
        };

        let sample_format = config.sample_format();
        let writer_clone = wav_writer.clone();
        let is_running_clone = is_running.clone();

        let stream_res = match sample_format {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if is_running_clone.load(Ordering::SeqCst) {
                        if let Ok(mut guard) = writer_clone.lock() {
                            if let Some(ref mut w) = *guard {
                                let _ = w.write_samples_f32(data);
                            }
                        }
                    }
                },
                move |err| {
                    eprintln!("[BetterShot Audio] System audio loopback stream error: {}", err);
                },
                None,
            ),
            cpal::SampleFormat::I16 => device.build_input_stream(
                &config.into(),
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    if is_running_clone.load(Ordering::SeqCst) {
                        if let Ok(mut guard) = writer_clone.lock() {
                            if let Some(ref mut w) = *guard {
                                let _ = w.write_samples_i16(data);
                            }
                        }
                    }
                },
                move |err| {
                    eprintln!("[BetterShot Audio] System audio loopback stream error: {}", err);
                },
                None,
            ),
            _ => {
                eprintln!("[BetterShot Audio] Unsupported system audio format: {:?}", sample_format);
                return;
            }
        };

        if let Ok(stream) = stream_res {
            if let Ok(()) = stream.play() {
                while is_running.load(Ordering::SeqCst) {
                    std::thread::sleep(Duration::from_millis(50));
                }
                drop(stream);
            }
        }
    });
}

fn spawn_mic_audio_capture_thread(
    mic_name: Option<String>,
    is_running: Arc<AtomicBool>,
    wav_writer: Arc<Mutex<Option<WavWriter>>>,
) {
    std::thread::spawn(move || {
        let host = cpal::default_host();
        let device = if let Some(ref target_name) = mic_name {
            if target_name.trim().is_empty()
                || target_name == "Built-in Microphone"
                || target_name == "Default System Audio Device"
            {
                host.default_input_device()
            } else {
                host.input_devices()
                    .ok()
                    .and_then(|mut devs| {
                        devs.find(|d| {
                            if let Ok(name) = d.name() {
                                name.to_lowercase().contains(&target_name.to_lowercase())
                                    || target_name.to_lowercase().contains(&name.to_lowercase())
                            } else {
                                false
                            }
                        })
                    })
                    .or_else(|| host.default_input_device())
            }
        } else {
            host.default_input_device()
        };

        let device = match device {
            Some(d) => d,
            None => {
                eprintln!("[BetterShot Audio] No microphone device found");
                return;
            }
        };

        let config = match device.default_input_config() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[BetterShot Audio] Failed to get mic input config: {}", e);
                return;
            }
        };

        let sample_format = config.sample_format();
        let writer_clone = wav_writer.clone();
        let is_running_clone = is_running.clone();

        let stream_res = match sample_format {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if is_running_clone.load(Ordering::SeqCst) {
                        if let Ok(mut guard) = writer_clone.lock() {
                            if let Some(ref mut w) = *guard {
                                let _ = w.write_samples_f32(data);
                            }
                        }
                    }
                },
                move |err| {
                    eprintln!("[BetterShot Audio] Mic stream error: {}", err);
                },
                None,
            ),
            cpal::SampleFormat::I16 => device.build_input_stream(
                &config.into(),
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    if is_running_clone.load(Ordering::SeqCst) {
                        if let Ok(mut guard) = writer_clone.lock() {
                            if let Some(ref mut w) = *guard {
                                let _ = w.write_samples_i16(data);
                            }
                        }
                    }
                },
                move |err| {
                    eprintln!("[BetterShot Audio] Mic stream error: {}", err);
                },
                None,
            ),
            _ => {
                eprintln!("[BetterShot Audio] Unsupported mic sample format: {:?}", sample_format);
                return;
            }
        };

        if let Ok(stream) = stream_res {
            if let Ok(()) = stream.play() {
                while is_running.load(Ordering::SeqCst) {
                    std::thread::sleep(Duration::from_millis(50));
                }
                drop(stream);
            }
        }
    });
}

#[tauri::command]
pub fn start_screen_recording(
    window: tauri::Window,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    save_path: String,
    is_fullscreen: bool,
    mic_enabled: Option<bool>,
    system_audio_enabled: Option<bool>,
    mic_name: Option<String>,
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
    let with_audio = mic_enabled.unwrap_or(false) || system_audio_enabled.unwrap_or(false);
    let video_record_file = if with_audio {
        format!("{}\\BetterShot_RawVideo_{}.mp4", std::env::temp_dir().display(), timestamp)
    } else {
        output_file.clone()
    };

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

    // Configure FFmpeg with zero-latency hardware/fast encoding & faststart moov placement
    let mut cmd = StdCommand::new("ffmpeg");

    cmd.arg("-f").arg("rawvideo")
        .arg("-pix_fmt").arg("bgra")
        .arg("-s").arg(format!("{}x{}", phys_w, phys_h))
        .arg("-r").arg("30")
        .arg("-i").arg("-")
        .arg("-c:v").arg("h264_mf")
        .arg("-rate_control").arg("cbr")
        .arg("-b:v").arg("6M")
        .arg("-pix_fmt").arg("yuv420p")
        .arg("-movflags").arg("+faststart")
        .arg("-y")
        .arg(&video_record_file);

    cmd.stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::from(stderr_file));

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    // Spawn FFmpeg process with fallback to libx264 ultrafast zerolatency if h264_mf fails
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(_) => {
            let stderr_file_fallback = std::fs::File::create(&stderr_log_path)
                .map_err(|e| format!("Failed to create fallback ffmpeg log: {}", e))?;
            let mut fallback_cmd = StdCommand::new("ffmpeg");
            fallback_cmd
                .arg("-f").arg("rawvideo")
                .arg("-pix_fmt").arg("bgra")
                .arg("-s").arg(format!("{}x{}", phys_w, phys_h))
                .arg("-r").arg("30")
                .arg("-i").arg("-")
                .arg("-c:v").arg("libx264")
                .arg("-preset").arg("ultrafast")
                .arg("-tune").arg("zerolatency")
                .arg("-pix_fmt").arg("yuv420p")
                .arg("-movflags").arg("+faststart")
                .arg("-y")
                .arg(&video_record_file);

            fallback_cmd
                .stdin(Stdio::piped())
                .stdout(Stdio::null())
                .stderr(Stdio::from(stderr_file_fallback));

            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                fallback_cmd.creation_flags(0x08000000);
            }

            fallback_cmd.spawn().map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    "FFmpeg not found. Please install FFmpeg and add it to your system PATH.".to_string()
                } else {
                    format!("Failed to start screen recording: {}", e)
                }
            })?
        }
    };

    let mut stdin = child.stdin.take().ok_or_else(|| "Failed to capture ffmpeg stdin".to_string())?;

    state.is_running.store(true, Ordering::SeqCst);
    let is_running_capture = state.is_running.clone();
    let is_running_encoder = state.is_running.clone();

    // Bounded zero-allocation frame pipeline: 4 recyclable frame buffers
    let frame_buffer_size = (phys_w * phys_h * 4) as usize;
    let (frame_tx, frame_rx): (SyncSender<Vec<u8>>, Receiver<Vec<u8>>) = sync_channel(4);
    let (recycle_tx, recycle_rx): (SyncSender<Vec<u8>>, Receiver<Vec<u8>>) = sync_channel(4);

    // Prepopulate recycling pool
    for _ in 0..4 {
        let _ = recycle_tx.send(vec![0u8; frame_buffer_size]);
    }

    // ─── Encoder Worker Thread (Reads from queue, writes to FFmpeg stdin) ───
    std::thread::spawn(move || {
        while is_running_encoder.load(Ordering::SeqCst) {
            match frame_rx.recv_timeout(Duration::from_millis(100)) {
                Ok(buf) => {
                    let write_ok = stdin.write_all(&buf).is_ok();
                    // Return recycled buffer to pool
                    let _ = recycle_tx.try_send(buf);
                    if !write_ok {
                        break;
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }

        // Drain any remaining buffered frames
        while let Ok(buf) = frame_rx.try_recv() {
            let _ = stdin.write_all(&buf);
        }

        let _ = stdin.flush();
        drop(stdin); // Closes stdin to finalize MP4 container
    });

    // ─── High-Speed GDI Capture Thread (Runs at steady 30 FPS deadline) ─────
    std::thread::spawn(move || {
        let frame_interval = Duration::from_nanos(33_333_333); // 30.000 FPS

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
                    biHeight: -phys_h, // top-down for BGRA
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: 0,
                    biSizeImage: frame_buffer_size as u32,
                    biXPelsPerMeter: 0,
                    biYPelsPerMeter: 0,
                    biClrUsed: 0,
                    biClrImportant: 0,
                },
                bmiColors: [windows::Win32::Graphics::Gdi::RGBQUAD::default()],
            };

            let mut cursor_cache = CursorCache::default();
            let mut next_frame_deadline = Instant::now();

            while is_running_capture.load(Ordering::SeqCst) {
                // 1. Acquire recyclable buffer from pool (or allocate if dry)
                let mut bgra_buf = match recycle_rx.try_recv() {
                    Ok(b) if b.len() == frame_buffer_size => b,
                    _ => vec![0u8; frame_buffer_size],
                };

                // 2. Perform GDI screen blit
                let bitblt_ok = BitBlt(
                    hdc_mem,
                    0,
                    0,
                    phys_w,
                    phys_h,
                    Some(hdc_screen),
                    phys_x,
                    phys_y,
                    ROP_CODE(SRCCOPY.0 | CAPTUREBLT.0),
                );

                if bitblt_ok.is_ok() {
                    // 3. Fast cached cursor stamping
                    let mut cursor_info = windows::Win32::UI::WindowsAndMessaging::CURSORINFO {
                        cbSize: std::mem::size_of::<windows::Win32::UI::WindowsAndMessaging::CURSORINFO>() as u32,
                        flags: windows::Win32::UI::WindowsAndMessaging::CURSORINFO_FLAGS(0),
                        hCursor: windows::Win32::UI::WindowsAndMessaging::HCURSOR(std::ptr::null_mut()),
                        ptScreenPos: windows::Win32::Foundation::POINT { x: 0, y: 0 },
                    };

                    if windows::Win32::UI::WindowsAndMessaging::GetCursorInfo(&mut cursor_info).is_ok()
                        && cursor_info.flags == windows::Win32::UI::WindowsAndMessaging::CURSOR_SHOWING
                    {
                        let current_handle = cursor_info.hCursor.0 as isize;
                        if current_handle != cursor_cache.last_handle {
                            let mut icon_info = windows::Win32::UI::WindowsAndMessaging::ICONINFO::default();
                            if windows::Win32::UI::WindowsAndMessaging::GetIconInfo(
                                windows::Win32::UI::WindowsAndMessaging::HICON(cursor_info.hCursor.0),
                                &mut icon_info,
                            ).is_ok() {
                                cursor_cache.last_handle = current_handle;
                                cursor_cache.hotspot_x = icon_info.xHotspot as i32;
                                cursor_cache.hotspot_y = icon_info.yHotspot as i32;

                                if !icon_info.hbmMask.0.is_null() {
                                    let _ = DeleteObject(icon_info.hbmMask.into());
                                }
                                if !icon_info.hbmColor.0.is_null() {
                                    let _ = DeleteObject(icon_info.hbmColor.into());
                                }
                            }
                        }

                        let cursor_x = cursor_info.ptScreenPos.x - phys_x - cursor_cache.hotspot_x;
                        let cursor_y = cursor_info.ptScreenPos.y - phys_y - cursor_cache.hotspot_y;

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
                    }

                    // 4. Extract DIB bits directly into recyclable buffer
                    GetDIBits(
                        hdc_mem,
                        hbmp,
                        0,
                        phys_h as u32,
                        Some(bgra_buf.as_mut_ptr() as *mut _),
                        &mut bmi,
                        DIB_RGB_COLORS,
                    );

                    // 5. Send frame to encoder worker (controlled drop on backpressure)
                    if let Err(TrySendError::Full(b)) = frame_tx.try_send(bgra_buf) {
                        let _ = recycle_rx.try_recv(); // discard if pool full
                        let _ = b;
                    }
                }

                // 6. Precise 30.000 FPS frame scheduling
                next_frame_deadline += frame_interval;
                let now = Instant::now();
                if next_frame_deadline > now {
                    std::thread::sleep(next_frame_deadline - now);
                } else if now.saturating_duration_since(next_frame_deadline) > Duration::from_millis(100) {
                    next_frame_deadline = now;
                }
            }

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
        let mut raw_path = state.raw_video_path.lock().map_err(|e| e.to_string())?;
        *raw_path = Some(video_record_file.clone());
    }

    {
        let mut log = state.stderr_log.lock().map_err(|e| e.to_string())?;
        *log = Some(stderr_log_path.clone());
    }

    // 1. Initialize System Audio Loopback
    if system_audio_enabled.unwrap_or(false) {
        let sys_wav = format!("{}\\BetterShot_Sys_{}.wav", std::env::temp_dir().display(), timestamp);
        let host = cpal::default_host();
        if let Some(dev) = host.default_output_device() {
            if let Ok(cfg) = dev.default_output_config() {
                let sample_rate = cfg.sample_rate().0;
                let channels = cfg.channels();
                if let Ok(writer) = WavWriter::create(&sys_wav, sample_rate, channels) {
                    *state.sys_wav_writer.lock().map_err(|e| e.to_string())? = Some(writer);
                    *state.sys_audio_path.lock().map_err(|e| e.to_string())? = Some(sys_wav.clone());
                    spawn_system_audio_capture_thread(state.is_running.clone(), state.sys_wav_writer.clone());
                }
            }
        }
    }

    // 2. Initialize Microphone Capture
    if mic_enabled.unwrap_or(false) {
        let mic_wav = format!("{}\\BetterShot_Mic_{}.wav", std::env::temp_dir().display(), timestamp);
        let host = cpal::default_host();
        let mic_dev = if let Some(ref target_name) = mic_name {
            if target_name.trim().is_empty()
                || target_name == "Built-in Microphone"
                || target_name == "Default System Audio Device"
            {
                host.default_input_device()
            } else {
                host.input_devices()
                    .ok()
                    .and_then(|mut devs| {
                        devs.find(|d| {
                            if let Ok(name) = d.name() {
                                name.to_lowercase().contains(&target_name.to_lowercase())
                                    || target_name.to_lowercase().contains(&name.to_lowercase())
                            } else {
                                false
                            }
                        })
                    })
                    .or_else(|| host.default_input_device())
            }
        } else {
            host.default_input_device()
        };

        if let Some(dev) = mic_dev {
            if let Ok(cfg) = dev.default_input_config() {
                let sample_rate = cfg.sample_rate().0;
                let channels = cfg.channels();
                if let Ok(writer) = WavWriter::create(&mic_wav, sample_rate, channels) {
                    *state.mic_wav_writer.lock().map_err(|e| e.to_string())? = Some(writer);
                    *state.mic_audio_path.lock().map_err(|e| e.to_string())? = Some(mic_wav.clone());
                    spawn_mic_audio_capture_thread(mic_name, state.is_running.clone(), state.mic_wav_writer.clone());
                }
            }
        }
    }

    eprintln!("[BetterShot] Screen recording active → {}", output_file);
    Ok(output_file)
}

#[tauri::command]
pub fn stop_screen_recording(
    state: tauri::State<'_, RecordingState>,
) -> Result<String, String> {
    // 1. Signal all frame & audio threads to stop
    state.is_running.store(false, Ordering::SeqCst);

    // Give audio threads a moment to finish current block
    std::thread::sleep(Duration::from_millis(150));

    // 2. Finalize WAV writers
    {
        let mut sys_w = state.sys_wav_writer.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut w) = *sys_w {
            let _ = w.finalize();
        }
        *sys_w = None;
    }
    {
        let mut mic_w = state.mic_wav_writer.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut w) = *mic_w {
            let _ = w.finalize();
        }
        *mic_w = None;
    }

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
            std::thread::sleep(Duration::from_millis(500));
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

    let raw_video = state.raw_video_path.lock().map_err(|e| e.to_string())?.take();
    let sys_audio = state.sys_audio_path.lock().map_err(|e| e.to_string())?.take();
    let mic_audio = state.mic_audio_path.lock().map_err(|e| e.to_string())?.take();

    if let Ok(mut log) = state.stderr_log.lock() {
        if let Some(ref log_path) = *log {
            let _ = std::fs::remove_file(log_path);
        }
        *log = None;
    }

    // Give filesystem a moment to flush file handles
    std::thread::sleep(Duration::from_millis(150));

    let raw_video_file = raw_video.unwrap_or_else(|| output.clone());

    let has_sys = sys_audio.as_ref().map(|p| std::path::Path::new(p).exists()).unwrap_or(false);
    let has_mic = mic_audio.as_ref().map(|p| std::path::Path::new(p).exists()).unwrap_or(false);

    if has_sys && has_mic {
        let sys_path = sys_audio.as_ref().unwrap();
        let mic_path = mic_audio.as_ref().unwrap();

        let mut mux_cmd = StdCommand::new("ffmpeg");
        mux_cmd
            .arg("-i").arg(&raw_video_file)
            .arg("-i").arg(sys_path)
            .arg("-i").arg(mic_path)
            .arg("-filter_complex").arg("[1:a][2:a]amix=inputs=2:duration=longest[aout]")
            .arg("-map").arg("0:v")
            .arg("-map").arg("[aout]")
            .arg("-c:v").arg("copy")
            .arg("-c:a").arg("aac")
            .arg("-b:a").arg("192k")
            .arg("-movflags").arg("+faststart")
            .arg("-shortest")
            .arg("-y")
            .arg(&output);

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            mux_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let _ = mux_cmd.output();
        let _ = std::fs::remove_file(&raw_video_file);
        let _ = std::fs::remove_file(sys_path);
        let _ = std::fs::remove_file(mic_path);
    } else if has_sys {
        let sys_path = sys_audio.as_ref().unwrap();

        let mut mux_cmd = StdCommand::new("ffmpeg");
        mux_cmd
            .arg("-i").arg(&raw_video_file)
            .arg("-i").arg(sys_path)
            .arg("-map").arg("0:v")
            .arg("-map").arg("1:a")
            .arg("-c:v").arg("copy")
            .arg("-c:a").arg("aac")
            .arg("-b:a").arg("192k")
            .arg("-movflags").arg("+faststart")
            .arg("-shortest")
            .arg("-y")
            .arg(&output);

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            mux_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let _ = mux_cmd.output();
        let _ = std::fs::remove_file(&raw_video_file);
        let _ = std::fs::remove_file(sys_path);
    } else if has_mic {
        let mic_path = mic_audio.as_ref().unwrap();

        let mut mux_cmd = StdCommand::new("ffmpeg");
        mux_cmd
            .arg("-i").arg(&raw_video_file)
            .arg("-i").arg(mic_path)
            .arg("-map").arg("0:v")
            .arg("-map").arg("1:a")
            .arg("-c:v").arg("copy")
            .arg("-c:a").arg("aac")
            .arg("-b:a").arg("192k")
            .arg("-movflags").arg("+faststart")
            .arg("-shortest")
            .arg("-y")
            .arg(&output);

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            mux_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let _ = mux_cmd.output();
        let _ = std::fs::remove_file(&raw_video_file);
        let _ = std::fs::remove_file(mic_path);
    }

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
pub fn generate_video_thumbnail(video_path: String) -> Result<String, String> {
    if !std::path::Path::new(&video_path).exists() {
        return Err("Video file does not exist".to_string());
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let temp_thumb_path = std::env::temp_dir().join(format!("thumb_{}.jpg", timestamp));
    let temp_thumb = temp_thumb_path.to_string_lossy().to_string();

    let mut cmd = StdCommand::new("ffmpeg");
    cmd.arg("-i").arg(&video_path)
        .arg("-ss").arg("00:00:00.100")
        .arg("-vframes").arg("1")
        .arg("-vf").arg("scale=320:-1")
        .arg("-q:v").arg("3")
        .arg("-y")
        .arg(&temp_thumb);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let status = cmd.status().map_err(|e| e.to_string())?;
    if !status.success() || !temp_thumb_path.exists() {
        // Retry without -ss seek if clip is very short (< 100ms)
        let mut retry_cmd = StdCommand::new("ffmpeg");
        retry_cmd.arg("-i").arg(&video_path)
            .arg("-vframes").arg("1")
            .arg("-vf").arg("scale=320:-1")
            .arg("-q:v").arg("3")
            .arg("-y")
            .arg(&temp_thumb);

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            retry_cmd.creation_flags(0x08000000);
        }
        let _ = retry_cmd.status();
    }

    if temp_thumb_path.exists() {
        let bytes = std::fs::read(&temp_thumb_path).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&temp_thumb_path);
        Ok(format!("data:image/jpeg;base64,{}", BASE64.encode(&bytes)))
    } else {
        Err("Failed to generate thumbnail".to_string())
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

#[tauri::command]
pub fn set_window_mode(window: tauri::Window, mode: String) -> Result<(), String> {
    let _ = window.show();
    let _ = window.set_focus();

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE};
        if let Ok(hwnd) = window.hwnd() {
            let affinity = if mode == "editor" { WDA_NONE } else { WDA_EXCLUDEFROMCAPTURE };
            unsafe {
                let _ = SetWindowDisplayAffinity(HWND(hwnd.0 as *mut _), affinity);
            }
        }
    }

    match mode.as_str() {
        "launcher" => {
            let _ = window.unmaximize();
            let _ = window.set_fullscreen(false);
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 420.0, height: 410.0 }));
            let _ = window.set_always_on_top(true);
            let _ = window.center();
            let _ = window.set_ignore_cursor_events(false);
        }
        "history" => {
            let _ = window.unmaximize();
            let _ = window.set_fullscreen(false);
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 520.0, height: 440.0 }));
            let _ = window.set_always_on_top(true);
            let _ = window.center();
            let _ = window.set_ignore_cursor_events(false);
        }
        "settings" => {
            let _ = window.unmaximize();
            let _ = window.set_fullscreen(false);
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 420.0, height: 430.0 }));
            let _ = window.set_always_on_top(true);
            let _ = window.center();
            let _ = window.set_ignore_cursor_events(false);
        }
        "area_selection" => {
            let _ = window.set_fullscreen(true);
            let _ = window.set_always_on_top(true);
            let _ = window.set_ignore_cursor_events(false);
        }
        "recording" => {
            let _ = window.unmaximize();
            let _ = window.set_fullscreen(false);
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 380.0, height: 74.0 }));
            let _ = window.set_always_on_top(true);
            if let Ok(Some(monitor)) = window.primary_monitor() {
                let mon_size = monitor.size();
                let scale = monitor.scale_factor();
                let bar_w = (380.0 * scale) as i32;
                let bar_h = (74.0 * scale) as i32;
                let x = (mon_size.width as i32 - bar_w) / 2;
                let y = mon_size.height as i32 - bar_h - (36.0 * scale) as i32;
                let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
            }
            let _ = window.set_ignore_cursor_events(false);
        }
        "editor" => {
            let _ = window.unmaximize();
            let _ = window.set_fullscreen(false);
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 960.0, height: 640.0 }));
            let _ = window.set_always_on_top(false);
            let _ = window.center();
            let _ = window.set_ignore_cursor_events(false);
        }
        _ => {}
    }
    Ok(())
}

#[tauri::command]
pub fn close_app_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn drag_window(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_maximize_window(window: tauri::Window) -> Result<(), String> {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    } else {
        let _ = window.maximize();
    }
    Ok(())
}

#[tauri::command]
pub fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

