use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

struct ActiveProcess(Arc<Mutex<Option<tokio::process::Child>>>);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppDefaults {
    workspace_root: String,
    python_entry_path: String,
    default_image_output_dir: String,
    default_capture_output_dir: String,
    default_game_path: String,
    default_process_name: String,
    default_probe_script_path: String,
    default_story_output_dir: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct EngineResult {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    exit_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExtractionState {
    running: bool,
    status: String,
}

fn get_defaults() -> AppDefaults {
    let workspace = PathBuf::from("D:\\Silverandblood\\silver-and-blood-next");
    let engine = workspace.join("engine");

    AppDefaults {
        workspace_root: workspace.to_string_lossy().to_string(),
        python_entry_path: engine.join("run_cli.py").to_string_lossy().to_string(),
        default_image_output_dir: workspace.join("output").join("unity_images").to_string_lossy().to_string(),
        default_capture_output_dir: workspace.join("output").join("captured").to_string_lossy().to_string(),
        default_game_path: "C:\\Program Files (x86)\\Silver And Blood".to_string(),
        default_process_name: "SilverAndBlood.exe".to_string(),
        default_probe_script_path: engine.join("probes").join("cdata_probe.js").to_string_lossy().to_string(),
        default_story_output_dir: workspace.join("output").join("stories").to_string_lossy().to_string(),
    }
}

#[tauri::command]
fn app_get_defaults() -> AppDefaults {
    get_defaults()
}

fn build_python_args() -> Vec<String> {
    let mut args = vec!["-u".to_string()];
    let defaults = get_defaults();
    args.push(defaults.python_entry_path.clone());
    args
}

async fn run_engine_command(
    app: tauri::AppHandle,
    state: tauri::State<'_, ActiveProcess>,
    extra_args: Vec<String>,
    status_label: &str,
) -> Result<EngineResult, String> {
    let defaults = get_defaults();
    let python = std::env::var("PYTHON_EXE").unwrap_or_else(|_| "python".to_string());

    let mut full_args = build_python_args();
    full_args.extend(extra_args);

    let cmd_str = format!("{} {}", python, full_args.join(" "));
    let _ = app.emit("extract:log", cmd_str);
    let _ = app.emit(
        "extract:state",
        ExtractionState {
            running: true,
            status: status_label.to_string(),
        },
    );

    let child = tokio::process::Command::new(&python)
        .args(&full_args)
        .current_dir(&defaults.workspace_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(0x08000000)
        .env("PYTHONUNBUFFERED", "1")
        .spawn();

    let mut child = match child {
        Ok(c) => c,
        Err(e) => {
            let _ = app.emit(
                "extract:state",
                ExtractionState {
                    running: false,
                    status: "Idle".to_string(),
                },
            );
            return Ok(EngineResult {
                ok: false,
                error: Some(format!("Failed to spawn process: {}", e)),
                exit_code: None,
            });
        }
    };

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let app_clone_stdout = app.clone();
    let app_clone_stderr = app.clone();
    let app_clone_wait = app.clone();

    if let Some(stdout) = stdout {
        tokio::spawn(async move {
            use tokio::io::AsyncBufReadExt;
            let reader = tokio::io::BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let trimmed = line.trim().to_string();
                if !trimmed.is_empty() {
                    let _ = app_clone_stdout.emit("extract:log", trimmed);
                }
            }
        });
    }

    if let Some(stderr) = stderr {
        tokio::spawn(async move {
            use tokio::io::AsyncBufReadExt;
            let reader = tokio::io::BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let trimmed = line.trim().to_string();
                if !trimmed.is_empty() {
                    let _ = app_clone_stderr.emit("extract:log", format!("ERR: {}", trimmed));
                }
            }
        });
    }

    *state.0.lock().unwrap() = Some(child);

    let state_arc = state.0.clone();
    tokio::spawn(async move {
        let child = {
            let mut guard = state_arc.lock().unwrap();
            guard.take()
        };
        if let Some(mut child) = child {
            let _ = child.wait().await;
        }
        let _ = app_clone_wait.emit(
            "extract:state",
            ExtractionState {
                running: false,
                status: "Idle".to_string(),
            },
        );
    });

    Ok(EngineResult {
        ok: true,
        exit_code: None,
        error: None,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImageExtractionOptions {
    game_path: String,
    output_dir: String,
    profile: Option<String>,
    name_filters: Option<Vec<String>>,
}

#[tauri::command]
async fn extract_run_image_extraction(
    app: tauri::AppHandle,
    state: tauri::State<'_, ActiveProcess>,
    options: ImageExtractionOptions,
) -> Result<EngineResult, String> {
    let game_path = options.game_path.trim().to_string();
    let output_dir = options.output_dir.trim().to_string();
    let profile = options.profile.unwrap_or_else(|| "core".to_string());

    if game_path.is_empty() {
        return Ok(EngineResult {
            ok: false,
            error: Some("Game path is required.".to_string()),
            exit_code: None,
        });
    }
    if output_dir.is_empty() {
        return Ok(EngineResult {
            ok: false,
            error: Some("Output directory is required.".to_string()),
            exit_code: None,
        });
    }

    let mut args = vec![
        "extract-images".to_string(),
        "--game-path".to_string(),
        game_path,
        "--output-dir".to_string(),
        output_dir,
        "--profile".to_string(),
        profile,
    ];

    if let Some(filters) = options.name_filters {
        for f in filters {
            let trimmed = f.trim().to_string();
            if !trimmed.is_empty() {
                args.push("--name-contains".to_string());
                args.push(trimmed);
            }
        }
    }

    run_engine_command(app, state, args, "Running image extraction...").await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaptureOptions {
    output_dir: String,
    process_name: Option<String>,
    probe_script: Option<String>,
    pid: Option<i32>,
    duration_seconds: Option<i32>,
}

#[tauri::command]
async fn capture_run_cdata(
    app: tauri::AppHandle,
    state: tauri::State<'_, ActiveProcess>,
    options: CaptureOptions,
) -> Result<EngineResult, String> {
    let defaults = get_defaults();
    let output_dir = options.output_dir.trim().to_string();

    if output_dir.is_empty() {
        return Ok(EngineResult {
            ok: false,
            error: Some("Output directory is required.".to_string()),
            exit_code: None,
        });
    }

    let mut args = vec![
        "capture-cdata".to_string(),
        "--output-dir".to_string(),
        output_dir,
    ];

    let probe = options
        .probe_script
        .unwrap_or_else(|| defaults.default_probe_script_path.clone())
        .trim()
        .to_string();
    if !probe.is_empty() {
        args.push("--probe-script".to_string());
        args.push(probe);
    }

    let proc_name = options
        .process_name
        .unwrap_or_else(|| defaults.default_process_name.clone())
        .trim()
        .to_string();
    if !proc_name.is_empty() {
        args.push("--process-name".to_string());
        args.push(proc_name);
    }

    if let Some(pid) = options.pid {
        if pid > 0 {
            args.push("--pid".to_string());
            args.push(pid.to_string());
        }
    }

    run_engine_command(app, state, args, "Running CData capture...").await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoryOptions {
    game_path: String,
    output_dir: String,
}

#[tauri::command]
async fn extract_run_stories(
    app: tauri::AppHandle,
    state: tauri::State<'_, ActiveProcess>,
    options: StoryOptions,
) -> Result<EngineResult, String> {
    let game_path = options.game_path.trim().to_string();
    let output_dir = options.output_dir.trim().to_string();

    if game_path.is_empty() {
        return Ok(EngineResult {
            ok: false,
            error: Some("Game path is required.".to_string()),
            exit_code: None,
        });
    }
    if output_dir.is_empty() {
        return Ok(EngineResult {
            ok: false,
            error: Some("Output directory is required.".to_string()),
            exit_code: None,
        });
    }

    let args = vec![
        "extract-stories".to_string(),
        "--game-path".to_string(),
        game_path,
        "--output-dir".to_string(),
        output_dir,
    ];

    run_engine_command(app, state, args, "Running story extraction...").await
}

#[tauri::command]
async fn process_stop(state: tauri::State<'_, ActiveProcess>) -> Result<EngineResult, String> {
    let mut guard = state.0.lock().unwrap();
    match guard.take() {
        Some(mut child) => {
            let _ = child.start_kill();
            Ok(EngineResult {
                ok: true,
                exit_code: None,
                error: None,
            })
        }
        None => Ok(EngineResult {
            ok: false,
            error: Some("No process running.".to_string()),
            exit_code: None,
        }),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ActiveProcess(Arc::new(Mutex::new(None))))
        .invoke_handler(tauri::generate_handler![
            app_get_defaults,
            extract_run_image_extraction,
            capture_run_cdata,
            extract_run_stories,
            process_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
