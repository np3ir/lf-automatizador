use std::collections::HashMap;
use std::fs::File;
use std::io::{self, BufRead, Write};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use cpal::traits::{DeviceTrait, HostTrait};
use cpal::Device;
use rodio::{ChannelCount, Decoder, DeviceSinkBuilder, MixerDeviceSink, Player, Sample, SampleRate, Source};

#[derive(Clone, Debug)]
struct PlayerState {
    path: String,
    status: String,
    position_ms: u64,
    gain: f32,
    bus_id: String,
    output_device_id: String,
    output_device_name: String,
}

impl Default for PlayerState {
    fn default() -> Self {
        Self {
            path: String::new(),
            status: "stopped".to_string(),
            position_ms: 0,
            gain: 1.0,
            bus_id: String::new(),
            output_device_id: String::new(),
            output_device_name: String::new(),
        }
    }
}

#[derive(Default)]
struct EngineState {
    players: HashMap<String, RuntimePlayer>,
    outputs: HashMap<String, OutputRuntime>,
    routes: HashMap<String, RouteState>,
    now_playing: Option<NowPlayingState>,
    transport: Option<TransportState>,
    encoder: EncoderState,
}

struct OutputRuntime {
    name: String,
    sink: MixerDeviceSink,
}

#[derive(Clone, Debug, Default)]
struct RouteState {
    output_device_id: String,
    output_device_name: String,
}

#[derive(Clone, Debug, Default)]
struct NowPlayingState {
    title: String,
    artist: String,
    path: String,
    player: String,
    source: String,
    updated_at: u128,
}

#[derive(Clone, Debug, Default)]
struct TransportState {
    player: String,
    status: String,
    position_ms: u64,
    duration_ms: u64,
    start_cause: String,
    mix_active: bool,
    mix_phase: String,
    mix_direction: String,
    mix_reference_player: String,
    updated_at: u128,
}

#[derive(Clone, Debug)]
struct EncoderState {
    active: bool,
    source_bus: String,
    owner: String,
    requested_owner: String,
    capture_provider: String,
    encoder_provider: String,
    rust_pcm_ready: bool,
    pcm_bridge_ready: bool,
    pcm_bridge_mode: String,
    pcm_bridge_reason: String,
    fallback_reason: String,
    capture_format: String,
    sample_rate: u64,
    transport: String,
    bitrate_kbps: f32,
    speed: f32,
    ffmpeg_time: String,
    max_gap_ms: f32,
    gap_warnings: u64,
    updated_at: u128,
}

impl Default for EncoderState {
    fn default() -> Self {
        Self {
            active: false,
            source_bus: "master".to_string(),
            owner: "none".to_string(),
            requested_owner: "none".to_string(),
            capture_provider: "none".to_string(),
            encoder_provider: "auto".to_string(),
            rust_pcm_ready: false,
            pcm_bridge_ready: false,
            pcm_bridge_mode: "planned".to_string(),
            pcm_bridge_reason: "rust-master-mix-not-yet-exported".to_string(),
            fallback_reason: String::new(),
            capture_format: String::new(),
            sample_rate: 0,
            transport: String::new(),
            bitrate_kbps: 0.0,
            speed: 0.0,
            ffmpeg_time: String::new(),
            max_gap_ms: 0.0,
            gap_warnings: 0,
            updated_at: 0,
        }
    }
}

struct RuntimePlayer {
    state: PlayerState,
    player: Option<Player>,
    meter: Arc<PlayerMeter>,
}

impl Default for RuntimePlayer {
    fn default() -> Self {
        Self {
            state: PlayerState::default(),
            player: None,
            meter: Arc::new(PlayerMeter::default()),
        }
    }
}

#[derive(Default)]
struct PlayerMeter {
    left_peak_bits: AtomicU32,
    right_peak_bits: AtomicU32,
}

impl PlayerMeter {
    fn reset(&self) {
        self.left_peak_bits.store(0.0f32.to_bits(), Ordering::Relaxed);
        self.right_peak_bits.store(0.0f32.to_bits(), Ordering::Relaxed);
    }

    fn set_peaks(&self, left: f32, right: f32) {
        self.left_peak_bits.store(left.clamp(0.0, 1.0).to_bits(), Ordering::Relaxed);
        self.right_peak_bits.store(right.clamp(0.0, 1.0).to_bits(), Ordering::Relaxed);
    }

    fn read(&self) -> (f32, f32) {
        (
            f32::from_bits(self.left_peak_bits.load(Ordering::Relaxed)),
            f32::from_bits(self.right_peak_bits.load(Ordering::Relaxed)),
        )
    }
}

struct MeteredSource<S>
where
    S: Source<Item = Sample>,
{
    source: S,
    meter: Arc<PlayerMeter>,
    channels: usize,
    sample_index: usize,
    window_samples: usize,
    window_left_peak: f32,
    window_right_peak: f32,
}

impl<S> MeteredSource<S>
where
    S: Source<Item = Sample>,
{
    fn new(source: S, meter: Arc<PlayerMeter>) -> Self {
        let channels = source.channels().get() as usize;
        meter.reset();
        Self {
            source,
            meter,
            channels: channels.max(1),
            sample_index: 0,
            window_samples: 0,
            window_left_peak: 0.0,
            window_right_peak: 0.0,
        }
    }
}

impl<S> Iterator for MeteredSource<S>
where
    S: Source<Item = Sample>,
{
    type Item = Sample;

    fn next(&mut self) -> Option<Self::Item> {
        let sample = self.source.next()?;
        let channel = self.sample_index % self.channels;
        let amplitude = sample.abs().min(1.0);
        if self.channels == 1 {
            self.window_left_peak = self.window_left_peak.max(amplitude);
            self.window_right_peak = self.window_right_peak.max(amplitude);
        } else if channel == 0 {
            self.window_left_peak = self.window_left_peak.max(amplitude);
        } else if channel == 1 {
            self.window_right_peak = self.window_right_peak.max(amplitude);
        }

        self.sample_index = self.sample_index.wrapping_add(1);
        self.window_samples += 1;
        if self.window_samples >= 1024 {
            self.meter.set_peaks(self.window_left_peak, self.window_right_peak);
            self.window_samples = 0;
            self.window_left_peak = 0.0;
            self.window_right_peak = 0.0;
        }
        Some(sample)
    }
}

impl<S> Source for MeteredSource<S>
where
    S: Source<Item = Sample>,
{
    fn current_span_len(&self) -> Option<usize> {
        self.source.current_span_len()
    }

    fn channels(&self) -> ChannelCount {
        self.source.channels()
    }

    fn sample_rate(&self) -> SampleRate {
        self.source.sample_rate()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.source.total_duration()
    }
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn json_get_string(input: &str, key: &str) -> Option<String> {
    let needle = format!("\"{}\"", key);
    let start = input.find(&needle)?;
    let after_key = &input[start + needle.len()..];
    let colon = after_key.find(':')?;
    let after_colon = after_key[colon + 1..].trim_start();
    if !after_colon.starts_with('"') {
        return None;
    }
    let mut out = String::new();
    let mut escaped = false;
    for ch in after_colon[1..].chars() {
        if escaped {
            out.push(ch);
            escaped = false;
            continue;
        }
        if ch == '\\' {
            escaped = true;
            continue;
        }
        if ch == '"' {
            return Some(out);
        }
        out.push(ch);
    }
    None
}

fn json_get_u64(input: &str, key: &str) -> Option<u64> {
    let needle = format!("\"{}\"", key);
    let start = input.find(&needle)?;
    let after_key = &input[start + needle.len()..];
    let colon = after_key.find(':')?;
    let value = after_key[colon + 1..]
        .trim_start()
        .chars()
        .take_while(|ch| ch.is_ascii_digit())
        .collect::<String>();
    value.parse().ok()
}

fn json_get_f32(input: &str, key: &str) -> Option<f32> {
    let needle = format!("\"{}\"", key);
    let start = input.find(&needle)?;
    let after_key = &input[start + needle.len()..];
    let colon = after_key.find(':')?;
    let value = after_key[colon + 1..]
        .trim_start()
        .chars()
        .take_while(|ch| ch.is_ascii_digit() || *ch == '.' || *ch == '-')
        .collect::<String>();
    value.parse().ok()
}

fn json_get_bool(input: &str, key: &str) -> Option<bool> {
    let needle = format!("\"{}\"", key);
    let start = input.find(&needle)?;
    let after_key = &input[start + needle.len()..];
    let colon = after_key.find(':')?;
    let value = after_key[colon + 1..].trim_start();
    if value.starts_with("true") {
        Some(true)
    } else if value.starts_with("false") {
        Some(false)
    } else {
        None
    }
}

fn escape_json(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn request_id_field(request_id: &str) -> String {
    if request_id.is_empty() {
        String::new()
    } else {
        format!("\"requestId\":\"{}\",", escape_json(request_id))
    }
}

fn emit_status(state: &EngineState, request_id: &str) {
    let mut active_outputs = Vec::new();
    for (id, output) in &state.outputs {
        active_outputs.push(format!(
            "{{\"id\":\"{}\",\"name\":\"{}\"}}",
            escape_json(id),
            escape_json(&output.name)
        ));
    }

    let mut players = Vec::new();
    let mut meters = Vec::new();
    for (id, runtime) in &state.players {
        let audio_ready = runtime.player.is_some();
        let position_ms = runtime
            .player
            .as_ref()
            .map(|player| player.get_pos().as_millis() as u64)
            .unwrap_or(runtime.state.position_ms);
        let status = runtime
            .player
            .as_ref()
            .map(|player| {
                if player.empty() && runtime.state.status == "playing" {
                    "ended".to_string()
                } else if player.is_paused() {
                    "paused".to_string()
                } else {
                    runtime.state.status.clone()
                }
            })
            .unwrap_or_else(|| runtime.state.status.clone());
        players.push(format!(
            "{{\"id\":\"{}\",\"status\":\"{}\",\"path\":\"{}\",\"positionMs\":{},\"gain\":{},\"audioReady\":{},\"outputDeviceId\":\"{}\",\"outputDeviceName\":\"{}\"}}",
            escape_json(id),
            escape_json(&status),
            escape_json(&runtime.state.path),
            position_ms,
            runtime.state.gain,
            audio_ready,
            escape_json(&runtime.state.output_device_id),
            escape_json(&runtime.state.output_device_name)
        ));
        let bus = if runtime.state.bus_id.trim().is_empty() {
            default_bus_for_player(id).to_string()
        } else {
            runtime.state.bus_id.clone()
        };
        let (meter_left, meter_right) = runtime.meter.read();
        let gain = runtime.state.gain.clamp(0.0, 2.0);
        let left_percent = if audio_ready && status == "playing" && gain > 0.0 {
            (meter_left * gain * 100.0).clamp(0.0, 100.0)
        } else {
            0.0
        };
        let right_percent = if audio_ready && status == "playing" && gain > 0.0 {
            (meter_right * gain * 100.0).clamp(0.0, 100.0)
        } else {
            0.0
        };
        let peak_percent = left_percent.max(right_percent);
        let meter_db = if peak_percent <= 0.0 {
            -120.0
        } else {
            20.0 * (peak_percent / 100.0).log10()
        };
        meters.push(format!(
            "{{\"id\":\"{}\",\"bus\":\"{}\",\"left\":{},\"right\":{},\"db\":{},\"status\":\"{}\",\"source\":\"player\"}}",
            escape_json(id),
            escape_json(&bus),
            left_percent,
            right_percent,
            meter_db,
            escape_json(&status)
        ));
    }
    let mut buses = Vec::new();
    for (bus, route) in &state.routes {
        buses.push(format!(
            "{{\"id\":\"{}\",\"outputDeviceId\":\"{}\",\"outputDeviceName\":\"{}\"}}",
            escape_json(bus),
            escape_json(&route.output_device_id),
            escape_json(&route.output_device_name)
        ));
    }
    let now_playing = state.now_playing.as_ref().map(|item| {
        format!(
            "{{\"title\":\"{}\",\"artist\":\"{}\",\"path\":\"{}\",\"player\":\"{}\",\"source\":\"{}\",\"updatedAt\":{}}}",
            escape_json(&item.title),
            escape_json(&item.artist),
            escape_json(&item.path),
            escape_json(&item.player),
            escape_json(&item.source),
            item.updated_at
        )
    }).unwrap_or_else(|| "null".to_string());
    let transport = state.transport.as_ref().map(|item| {
        format!(
            "{{\"player\":\"{}\",\"status\":\"{}\",\"positionMs\":{},\"durationMs\":{},\"startCause\":\"{}\",\"mixActive\":{},\"mixPhase\":\"{}\",\"mixDirection\":\"{}\",\"mixReferencePlayer\":\"{}\",\"updatedAt\":{}}}",
            escape_json(&item.player),
            escape_json(&item.status),
            item.position_ms,
            item.duration_ms,
            escape_json(&item.start_cause),
            item.mix_active,
            escape_json(&item.mix_phase),
            escape_json(&item.mix_direction),
            escape_json(&item.mix_reference_player),
            item.updated_at
        )
    }).unwrap_or_else(|| "null".to_string());
    let encoder = format!(
        "{{\"active\":{},\"source\":\"{}\",\"owner\":\"{}\",\"requestedOwner\":\"{}\",\"captureProvider\":\"{}\",\"encoderProvider\":\"{}\",\"rustPcmReady\":{},\"pcmBridgeReady\":{},\"pcmBridgeMode\":\"{}\",\"pcmBridgeReason\":\"{}\",\"fallbackReason\":\"{}\",\"captureFormat\":\"{}\",\"sampleRate\":{},\"transport\":\"{}\",\"bitrateKbps\":{},\"speed\":{},\"ffmpegTime\":\"{}\",\"maxGapMs\":{},\"gapWarnings\":{},\"updatedAt\":{}}}",
        state.encoder.active,
        escape_json(&state.encoder.source_bus),
        escape_json(&state.encoder.owner),
        escape_json(&state.encoder.requested_owner),
        escape_json(&state.encoder.capture_provider),
        escape_json(&state.encoder.encoder_provider),
        state.encoder.rust_pcm_ready,
        state.encoder.pcm_bridge_ready,
        escape_json(&state.encoder.pcm_bridge_mode),
        escape_json(&state.encoder.pcm_bridge_reason),
        escape_json(&state.encoder.fallback_reason),
        escape_json(&state.encoder.capture_format),
        state.encoder.sample_rate,
        escape_json(&state.encoder.transport),
        state.encoder.bitrate_kbps,
        state.encoder.speed,
        escape_json(&state.encoder.ffmpeg_time),
        state.encoder.max_gap_ms,
        state.encoder.gap_warnings,
        state.encoder.updated_at
    );
    println!(
        "{{{}\"type\":\"status\",\"engine\":\"rustAudio\",\"version\":\"0.2.13\",\"labPlayback\":{},\"updatedAt\":{},\"activeOutputs\":[{}],\"buses\":[{}],\"nowPlaying\":{},\"transport\":{},\"encoder\":{},\"players\":[{}],\"meters\":[{}]}}",
        request_id_field(request_id),
        has_active_audio(state),
        now_ms(),
        active_outputs.join(","),
        buses.join(","),
        now_playing,
        transport,
        encoder,
        players.join(","),
        meters.join(",")
    );
    let _ = io::stdout().flush();
}

fn device_id(device: &Device, fallback_index: usize) -> String {
    device
        .id()
        .map(|id| id.to_string())
        .unwrap_or_else(|_| format!("output:{}", fallback_index))
}

fn device_name(device: &Device, fallback_index: usize) -> String {
    device
        .description()
        .map(|description| description.to_string())
        .unwrap_or_else(|_| format!("Salida {}", fallback_index + 1))
}

fn collect_output_devices() -> Result<(String, String, String, String, Vec<String>), String> {
    let host = cpal::default_host();
    let host_name = host.id().name().to_string();
    let available_hosts = cpal::available_hosts()
        .iter()
        .map(|host_id| host_id.name().to_string())
        .collect::<Vec<String>>()
        .join(",");
    let default_device = host.default_output_device();
    let default_id = default_device
        .as_ref()
        .map(|device| device_id(device, 0))
        .unwrap_or_else(|| "default".to_string());
    let default_name = default_device
        .as_ref()
        .map(|device| device_name(device, 0))
        .unwrap_or_else(|| "default".to_string());
    let devices = host
        .output_devices()
        .map_err(|err| format!("No se pudieron listar salidas de audio: {}", err))?;
    let mut outputs = Vec::new();
    for (index, device) in devices.enumerate() {
        let id = device_id(&device, index);
        let name = device_name(&device, index);
        let index_id = format!("output:{}", index);
        let is_default = id == default_id;
        outputs.push(format!(
            "{{\"id\":\"{}\",\"indexId\":\"{}\",\"name\":\"{}\",\"isDefault\":{}}}",
            escape_json(&id),
            escape_json(&index_id),
            escape_json(&name),
            is_default
        ));
    }
    Ok((host_name, available_hosts, default_id, default_name, outputs))
}

fn emit_devices(request_id: &str) {
    match collect_output_devices() {
        Ok((host_name, available_hosts, default_output_id, default_output, outputs)) => {
            println!(
                "{{{}\"type\":\"devices\",\"engine\":\"rustAudio\",\"version\":\"0.2.13\",\"updatedAt\":{},\"host\":\"{}\",\"availableHosts\":\"{}\",\"defaultOutput\":\"{}\",\"defaultOutputId\":\"{}\",\"outputs\":[{}]}}",
                request_id_field(request_id),
                now_ms(),
                escape_json(&host_name),
                escape_json(&available_hosts),
                escape_json(&default_output),
                escape_json(&default_output_id),
                outputs.join(",")
            );
            let _ = io::stdout().flush();
        }
        Err(err) => emit_error(&err, request_id),
    }
}

fn find_output_device(requested_id: &str) -> Result<(Device, String, String), String> {
    let host = cpal::default_host();
    let requested = requested_id.trim();
    if requested.is_empty() || requested == "default" {
        let device = host.default_output_device().ok_or_else(|| "No hay salida de audio default.".to_string())?;
        let id = device_id(&device, 0);
        let name = device_name(&device, 0);
        return Ok((device, id, name));
    }

    let requested_index = requested
        .strip_prefix("output:")
        .and_then(|value| value.parse::<usize>().ok());
    let devices = host
        .output_devices()
        .map_err(|err| format!("No se pudieron leer salidas de audio: {}", err))?;
    for (index, device) in devices.enumerate() {
        let id = device_id(&device, index);
        let name = device_name(&device, index);
        if requested_index == Some(index) || requested == id || requested == name {
            return Ok((device, id, name));
        }
    }
    Err(format!("Salida Rust no encontrada: {}", requested))
}

fn ensure_output(state: &mut EngineState, requested_id: &str) -> Result<(String, String), String> {
    let requested = if requested_id.trim().is_empty() { "default" } else { requested_id.trim() };
    let (device, id, name) = find_output_device(requested)?;
    if state.outputs.contains_key(&id) {
        return Ok((id, name));
    }

    let mut output = DeviceSinkBuilder::from_device(device)
        .map_err(|err| format!("No se pudo preparar salida {}: {}", name, err))?
        .open_sink_or_fallback()
        .map_err(|err| format!("No se pudo abrir salida {}: {}", name, err))?;
    output.log_on_drop(false);
    state.outputs.insert(id.clone(), OutputRuntime { name: name.clone(), sink: output });
    Ok((id, name))
}

fn load_audio_player(state: &mut EngineState, player_id: &str, file_path: &str, gain: f32, paused: bool, output_id: &str, bus_id: &str) -> Result<(), String> {
    let (resolved_output_id, resolved_output_name) = ensure_output(state, output_id)?;
    let output = state.outputs.get(&resolved_output_id).ok_or_else(|| "Salida Rust no disponible.".to_string())?;
    let file = File::open(file_path).map_err(|err| format!("No se pudo abrir archivo: {}", err))?;
    let decoder = Decoder::try_from(file).map_err(|err| format!("No se pudo decodificar audio: {}", err))?;
    let player = Player::connect_new(output.sink.mixer());
    player.set_volume(gain.clamp(0.0, 2.0));
    if paused {
        player.pause();
    }

    let runtime = state.players.entry(player_id.to_string()).or_default();
    if let Some(old_player) = runtime.player.take() {
        old_player.stop();
    }
    runtime.meter = Arc::new(PlayerMeter::default());
    let metered_source = MeteredSource::new(decoder, Arc::clone(&runtime.meter));
    player.append(metered_source);
    runtime.state.path = file_path.to_string();
    runtime.state.status = if paused { "loaded".to_string() } else { "playing".to_string() };
    runtime.state.position_ms = 0;
    runtime.state.gain = gain.clamp(0.0, 2.0);
    runtime.state.bus_id = bus_id.to_string();
    runtime.state.output_device_id = resolved_output_id;
    runtime.state.output_device_name = resolved_output_name;
    runtime.player = Some(player);
    Ok(())
}

fn route_bus(state: &mut EngineState, bus_id: &str, output_id: &str) -> Result<(), String> {
    let (resolved_output_id, resolved_output_name) = ensure_output(state, output_id)?;
    state.routes.insert(bus_id.to_string(), RouteState {
        output_device_id: resolved_output_id,
        output_device_name: resolved_output_name,
    });
    Ok(())
}

fn update_now_playing(state: &mut EngineState, line: &str) {
    state.now_playing = Some(NowPlayingState {
        title: json_get_string(line, "title").unwrap_or_default(),
        artist: json_get_string(line, "artist").unwrap_or_default(),
        path: json_get_string(line, "path").unwrap_or_default(),
        player: json_get_string(line, "player").unwrap_or_default(),
        source: json_get_string(line, "source").unwrap_or_else(|| "renderer".to_string()),
        updated_at: now_ms(),
    });
}

fn update_transport(state: &mut EngineState, line: &str) {
    state.transport = Some(TransportState {
        player: json_get_string(line, "player").unwrap_or_default(),
        status: json_get_string(line, "status").unwrap_or_else(|| "unknown".to_string()),
        position_ms: json_get_u64(line, "positionMs").unwrap_or(0),
        duration_ms: json_get_u64(line, "durationMs").unwrap_or(0),
        start_cause: json_get_string(line, "startCause").unwrap_or_default(),
        mix_active: json_get_bool(line, "mixActive").unwrap_or(false),
        mix_phase: json_get_string(line, "mixPhase").unwrap_or_default(),
        mix_direction: json_get_string(line, "mixDirection").unwrap_or_default(),
        mix_reference_player: json_get_string(line, "mixReferencePlayer").unwrap_or_default(),
        updated_at: now_ms(),
    });
}

fn update_encoder(state: &mut EngineState, line: &str) {
    let action = json_get_string(line, "action").unwrap_or_else(|| "status".to_string());
    if action == "stop" {
        state.encoder.active = false;
        state.encoder.bitrate_kbps = 0.0;
        state.encoder.speed = 0.0;
        state.encoder.ffmpeg_time.clear();
        state.encoder.max_gap_ms = 0.0;
        state.encoder.gap_warnings = 0;
    } else if action == "start" {
        state.encoder.active = true;
    }
    state.encoder.source_bus = json_get_string(line, "source")
        .or_else(|| json_get_string(line, "sourceBus"))
        .unwrap_or_else(|| state.encoder.source_bus.clone());
    state.encoder.owner = json_get_string(line, "owner").unwrap_or_else(|| state.encoder.owner.clone());
    state.encoder.requested_owner = json_get_string(line, "requestedOwner").unwrap_or_else(|| state.encoder.requested_owner.clone());
    state.encoder.capture_provider = json_get_string(line, "captureProvider").unwrap_or_else(|| state.encoder.capture_provider.clone());
    state.encoder.encoder_provider = json_get_string(line, "encoderProvider").unwrap_or_else(|| state.encoder.encoder_provider.clone());
    state.encoder.rust_pcm_ready = json_get_bool(line, "rustPcmReady").unwrap_or(state.encoder.rust_pcm_ready);
    state.encoder.pcm_bridge_ready = json_get_bool(line, "pcmBridgeReady").unwrap_or(state.encoder.pcm_bridge_ready);
    state.encoder.pcm_bridge_mode = json_get_string(line, "pcmBridgeMode").unwrap_or_else(|| state.encoder.pcm_bridge_mode.clone());
    state.encoder.pcm_bridge_reason = json_get_string(line, "pcmBridgeReason").unwrap_or_else(|| state.encoder.pcm_bridge_reason.clone());
    state.encoder.fallback_reason = json_get_string(line, "fallbackReason").unwrap_or_else(|| state.encoder.fallback_reason.clone());
    state.encoder.capture_format = json_get_string(line, "captureFormat").unwrap_or_else(|| state.encoder.capture_format.clone());
    state.encoder.sample_rate = json_get_u64(line, "sampleRate").unwrap_or(state.encoder.sample_rate);
    state.encoder.transport = json_get_string(line, "transport").unwrap_or_else(|| state.encoder.transport.clone());
    state.encoder.bitrate_kbps = json_get_f32(line, "bitrateKbps").unwrap_or(state.encoder.bitrate_kbps);
    state.encoder.speed = json_get_f32(line, "speed").unwrap_or(state.encoder.speed);
    state.encoder.ffmpeg_time = json_get_string(line, "ffmpegTime").unwrap_or_else(|| state.encoder.ffmpeg_time.clone());
    state.encoder.max_gap_ms = json_get_f32(line, "maxGapMs").unwrap_or(state.encoder.max_gap_ms);
    state.encoder.gap_warnings = json_get_u64(line, "gapWarnings").unwrap_or(state.encoder.gap_warnings);
    state.encoder.updated_at = now_ms();
}

fn resolve_output_for_bus(state: &EngineState, bus_id: &str, fallback_output_id: &str) -> String {
    if let Some(route) = state.routes.get(bus_id) {
        if !route.output_device_id.is_empty() {
            return route.output_device_id.clone();
        }
    }
    if fallback_output_id.trim().is_empty() {
        "default".to_string()
    } else {
        fallback_output_id.to_string()
    }
}

fn default_bus_for_player(player_id: &str) -> &'static str {
    match player_id {
        "player-a" | "player-b" => "master",
        "jingle-player" | "jingle" => "jingle",
        "cue-player" | "preview-player" | "editor-player" => "cue",
        "cartwall" | "cartwall-player" => "cartwall",
        "pl1" | "playlist-1" => "pl1",
        "pl2" | "playlist-2" => "pl2",
        "pl3" | "playlist-3" => "pl3",
        "pl4" | "playlist-4" => "pl4",
        _ => "",
    }
}

fn is_diagnostic_player(player_id: &str) -> bool {
    matches!(
        player_id,
        "preview-player"
            | "lab"
            | "jingle-player"
            | "jingle"
            | "cartwall-player"
            | "cue-player"
            | "pl1"
            | "pl2"
            | "pl3"
            | "pl4"
    ) || player_id.starts_with("route-map-")
}

fn has_active_audio(state: &EngineState) -> bool {
    state.players.values().any(|runtime| {
        runtime.player.is_some()
            && matches!(runtime.state.status.as_str(), "playing" | "paused" | "loaded")
    })
}

fn emit_error(message: &str, request_id: &str) {
    println!(
        "{{{}\"type\":\"error\",\"engine\":\"rustAudio\",\"message\":\"{}\",\"updatedAt\":{}}}",
        request_id_field(request_id),
        escape_json(message),
        now_ms()
    );
    let _ = io::stdout().flush();
}

fn main() {
    let stdin = io::stdin();
    let mut state = EngineState::default();
    println!(
        "{{\"type\":\"ready\",\"engine\":\"rustAudio\",\"version\":\"0.2.13\",\"updatedAt\":{}}}",
        now_ms()
    );
    let _ = io::stdout().flush();

    for line in stdin.lock().lines() {
        let Ok(line) = line else {
            emit_error("No se pudo leer comando.", "");
            continue;
        };
        let cmd = json_get_string(&line, "cmd").unwrap_or_default();
        let request_id = json_get_string(&line, "requestId").unwrap_or_default();
        let player_id = json_get_string(&line, "player").unwrap_or_else(|| "probe".to_string());

        match cmd.as_str() {
            "status" => {}
            "devices" => emit_devices(&request_id),
            "load" => {
                let runtime = state.players.entry(player_id.clone()).or_default();
                runtime.state.path = json_get_string(&line, "path").unwrap_or_default();
                runtime.state.status = "loaded".to_string();
                runtime.state.position_ms = 0;
            }
            "route" => {
                let bus_id = json_get_string(&line, "bus").unwrap_or_else(|| player_id.clone());
                let output_id = json_get_string(&line, "outputId").unwrap_or_else(|| "default".to_string());
                if let Err(err) = route_bus(&mut state, &bus_id, &output_id) {
                    emit_error(&err, &request_id);
                }
            }
            "nowPlaying" => update_now_playing(&mut state, &line),
            "transport" => update_transport(&mut state, &line),
            "encoder" => update_encoder(&mut state, &line),
            "loadAudio" => {
                let current_gain = state.players.get(&player_id).map(|runtime| runtime.state.gain).unwrap_or(1.0);
                let path = json_get_string(&line, "path").unwrap_or_default();
                let gain = json_get_f32(&line, "gain").unwrap_or(current_gain);
                let output_id = json_get_string(&line, "outputId").unwrap_or_else(|| "default".to_string());
                let bus_id = json_get_string(&line, "bus").unwrap_or_else(|| default_bus_for_player(&player_id).to_string());
                let resolved_output_id = resolve_output_for_bus(&state, &bus_id, &output_id);
                if let Err(err) = load_audio_player(&mut state, &player_id, &path, gain, true, &resolved_output_id, &bus_id) {
                    emit_error(&err, &request_id);
                }
            }
            "labPlay" => {
                let current = state.players.get(&player_id).map(|runtime| (runtime.state.path.clone(), runtime.state.gain)).unwrap_or_else(|| (String::new(), 1.0));
                let path = json_get_string(&line, "path").unwrap_or(current.0);
                let gain = json_get_f32(&line, "gain").unwrap_or(current.1);
                let output_id = json_get_string(&line, "outputId").unwrap_or_else(|| "default".to_string());
                let bus_id = json_get_string(&line, "bus").unwrap_or_else(|| default_bus_for_player(&player_id).to_string());
                let resolved_output_id = resolve_output_for_bus(&state, &bus_id, &output_id);
                if let Err(err) = load_audio_player(&mut state, &player_id, &path, gain, false, &resolved_output_id, &bus_id) {
                    emit_error(&err, &request_id);
                }
            }
            "play" => {
                let runtime = state.players.entry(player_id.clone()).or_default();
                runtime.state.status = "playing".to_string();
                if let Some(player) = &runtime.player {
                    player.play();
                }
            }
            "pause" => {
                let runtime = state.players.entry(player_id.clone()).or_default();
                runtime.state.status = "paused".to_string();
                if let Some(player) = &runtime.player {
                    player.pause();
                }
            }
            "stop" => {
                if let Some(runtime) = state.players.get_mut(&player_id) {
                    runtime.state.status = "stopped".to_string();
                    runtime.state.position_ms = 0;
                    runtime.meter.reset();
                    if let Some(player) = runtime.player.take() {
                        player.stop();
                    }
                }
                if is_diagnostic_player(&player_id) {
                    state.players.remove(&player_id);
                }
            }
            "seek" => {
                if let Some(runtime) = state.players.get_mut(&player_id) {
                    runtime.state.position_ms = json_get_u64(&line, "positionMs").unwrap_or(runtime.state.position_ms);
                    if let Some(player) = &runtime.player {
                        let _ = player.try_seek(Duration::from_millis(runtime.state.position_ms));
                    }
                }
            }
            "setGain" => {
                let runtime = state.players.entry(player_id.clone()).or_default();
                runtime.state.gain = json_get_f32(&line, "gain").unwrap_or(runtime.state.gain).clamp(0.0, 2.0);
                if let Some(player) = &runtime.player {
                    player.set_volume(runtime.state.gain);
                }
            }
            "" => emit_error("Comando sin campo cmd.", &request_id),
            other => emit_error(&format!("Comando no soportado: {}", other), &request_id),
        }

        emit_status(&state, &request_id);
    }
}
