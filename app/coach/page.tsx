"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// ── Types & constants ────────────────────────────────────────────────────────

type FocusType = "pace" | "fillers" | "energy" | "variation" | "gestures" | "posture" | "content";

interface GeminiFeedback {
  feedback: string;
  focus: FocusType;
  reason: string;
}

const FOCUS_STYLES: Record<FocusType, { bg: string; accent: string; pill: string }> = {
  pace:      { bg: "#eff6ff", accent: "#1d4ed8", pill: "#bfdbfe" },
  fillers:   { bg: "#fffbeb", accent: "#b45309", pill: "#fde68a" },
  energy:    { bg: "#f5f3ff", accent: "#6d28d9", pill: "#ddd6fe" },
  variation: { bg: "#f0fdf4", accent: "#15803d", pill: "#bbf7d0" },
  gestures:  { bg: "#f0fdf4", accent: "#166534", pill: "#86efac" },
  posture:   { bg: "#eef2ff", accent: "#3730a3", pill: "#c7d2fe" },
  content:   { bg: "#fdf2f8", accent: "#9d174d", pill: "#fbcfe8" },
};

const FOCUS_ICONS: Record<FocusType, string> = {
  pace: "⏱️", fillers: "🤐", energy: "⚡", variation: "🎵",
  gestures: "🙌", posture: "🧍", content: "📋",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function countFillers(text: string) {
  const fillers = ["um", "uh", "like", "you know", "so"];
  const lower = (text || "").toLowerCase();
  let count = 0;
  for (const f of fillers) {
    const matches = lower.match(new RegExp(`\\b${f.replace(" ", "\\s+")}\\b`, "g"));
    if (matches) count += matches.length;
  }
  return count;
}

function estimateWpm(words: number, seconds: number) {
  return !seconds || seconds <= 0 ? 0 : Math.round((words / seconds) * 60);
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

function ScoreBar({ value, color = "#6d28d9" }: { value: number; color?: string }) {
  return (
    <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden", marginTop: 4 }}>
      <div style={{ height: "100%", width: `${Math.round(value * 100)}%`, background: color, borderRadius: 99, transition: "width 0.4s ease" }} />
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CoachPage() {
  // Camera / pose refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const poseRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastHandsRef = useRef<{ t: number; lx: number; ly: number; rx: number; ry: number } | null>(null);
  const lastPoseTimeRef = useRef(0);

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Uint8Array | null>(null);
  const volumeHistoryRef = useRef<number[]>([]);
  const audioRafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // State
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [transcript, setTranscript] = useState("");
  const [recentTranscript, setRecentTranscript] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [fillerCount, setFillerCount] = useState(0);
  const [gestureEnergy, setGestureEnergy] = useState(0);
  const [postureScore, setPostureScore] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [energyScore, setEnergyScore] = useState(0);
  const [variationScore, setVariationScore] = useState(0);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const recRef = useRef<any>(null);
  const isRecordingRef = useRef(false);

  // Gemini state
  const [fullSpeech, setFullSpeech] = useState("");
  const [feedback, setFeedback] = useState<GeminiFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Stable refs for interval (avoid stale closures)
  const metricsRef = useRef({ wpm: 0, fillerCount: 0, gestureEnergy: 0, postureScore: 0, volumeLevel: 0, energyScore: 0, variationScore: 0 });
  const transcriptRef = useRef("");
  const fullSpeechRef = useRef("");
  const isLiveRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    metricsRef.current = { wpm, fillerCount, gestureEnergy, postureScore, volumeLevel, energyScore, variationScore };
  }, [wpm, fillerCount, gestureEnergy, postureScore, volumeLevel, energyScore, variationScore]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { fullSpeechRef.current = fullSpeech; }, [fullSpeech]);
  useEffect(() => { isLiveRef.current = status === "live"; }, [status]);
  useEffect(() => { startedAtRef.current = startedAt; }, [startedAt]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  // ── Ask Coach (on-demand) ──────────────────────────────────────────────────
  const askCoach = async () => {
    if (feedbackLoading) return;
    setFeedbackLoading(true);
    setFeedbackError(null);
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metrics: metricsRef.current,
          liveTranscript: transcriptRef.current,
          fullSpeech: fullSpeechRef.current,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.feedback && data.focus) {
        setFeedback(data as GeminiFeedback);
      } else {
        setFeedbackError("Unexpected response from coach.");
      }
    } catch (e) {
      console.error("Gemini error:", e);
      setFeedbackError("Coach unavailable — try again.");
    } finally {
      setFeedbackLoading(false);
    }
  };

  // ── Camera + audio ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = audioCtx;
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;
        src.connect(analyser);
        audioDataRef.current = new Uint8Array(analyser.fftSize);
        setStatus("live");
      } catch {
        setStatus("error");
      }
    })();
    return () => {
      if (audioRafRef.current) cancelAnimationFrame(audioRafRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  // ── Audio analysis loop ────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const analyser = analyserRef.current, data = audioDataRef.current;
      if (analyser && data) {
        analyser.getByteTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sumSq += v * v; }
        const level = Math.min(1, Math.sqrt(sumSq / data.length) * 2.5);
        setVolumeLevel(level);
        setEnergyScore(p => p * 0.85 + level * 0.15);
        const hist = volumeHistoryRef.current;
        hist.push(level);
        if (hist.length > 60) hist.shift();
        const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
        const std = Math.sqrt(hist.reduce((a, b) => a + (b - mean) ** 2, 0) / hist.length);
        setVariationScore(clamp01(std * 6));
      }
      audioRafRef.current = requestAnimationFrame(tick);
    };
    audioRafRef.current = requestAnimationFrame(tick);
    return () => { if (audioRafRef.current) cancelAnimationFrame(audioRafRef.current); };
  }, []);

  // ── Speech recognition ────────────────────────────────────────────────────
  const SpeechRecognition = useMemo(() => {
    if (typeof window === "undefined") return null;
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  }, []);

  useEffect(() => {
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    rec.onresult = (event: any) => {
      let finalFull = "", interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const chunk = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalFull += chunk + " ";
      }
      const last = event.results.length - 1;
      if (last >= 0 && !event.results[last].isFinal)
        interim = (event.results[last][0]?.transcript || "").trim();
      setTranscript(finalFull.trim());
      setRecentTranscript(interim);
      if (!startedAtRef.current) setStartedAt(Date.now());
    };
    // Auto-restart if recording is still active (browser ends session after silence)
    rec.onend = () => { if (isRecordingRef.current) rec.start(); };
    recRef.current = rec;
    return () => { rec.stop(); recRef.current = null; };
  }, [SpeechRecognition]);

  // ── Recording handlers ────────────────────────────────────────────────────
  const startRecording = () => {
    if (!recRef.current || isRecordingRef.current) return;
    setIsRecording(true);
    recRef.current.start();

  };

  const stopRecording = () => {
    if (!recRef.current || !isRecordingRef.current) return;
    setIsRecording(false);
    isRecordingRef.current = false; // set immediately so onend won't restart
    recRef.current.stop();
  };

  const clearTranscript = () => {
    setTranscript("");
    setRecentTranscript("");
    setStartedAt(null);
    setWpm(0);
    setFillerCount(0);
    // Stop & restart recognition to flush its internal results buffer
    if (isRecordingRef.current && recRef.current) {
      recRef.current.stop(); // onend will auto-restart since isRecordingRef is still true
    }
  };

  // ── WPM + filler counter ──────────────────────────────────────────────────
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => {
      const secs = (Date.now() - startedAt) / 1000;
      setWpm(estimateWpm(transcript.split(/\s+/).filter(Boolean).length, secs));
      setFillerCount(countFillers(transcript));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt, transcript]);

  // ── Pose detection ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      poseRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task" },
        runningMode: "VIDEO", numPoses: 1,
      });
    })();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); poseRef.current?.close(); };
  }, []);

  useEffect(() => {
    const loop = () => {
      const video = videoRef.current, pose = poseRef.current;
      const now = performance.now();
      // Throttle to ~15 fps to avoid overwhelming MediaPipe
      if (video && pose && video.readyState >= 2 && now - lastPoseTimeRef.current >= 66) {
        lastPoseTimeRef.current = now;
        const t = now, res = pose.detectForVideo(video, t), lm = res.landmarks?.[0];
        if (lm) {
          const lw = lm[15], rw = lm[16], ls = lm[11], rs = lm[12], nose = lm[0];
          const vis = [lw, rw, ls, rs].every(p => (p?.visibility ?? 0) > 0.4);
          if (vis) {
            const last = lastHandsRef.current;
            if (last) {
              const dt = (t - last.t) / 1000;
              if (dt > 0) setGestureEnergy(clamp01(
                (Math.hypot(lw.x - last.lx, lw.y - last.ly) + Math.hypot(rw.x - last.rx, rw.y - last.ry)) / dt / 2.2
              ));
            }
            lastHandsRef.current = { t, lx: lw.x, ly: lw.y, rx: rw.x, ry: rw.y };
            setPostureScore(clamp01(0.65 * clamp01(1 - Math.abs(ls.y - rs.y) * 10) + 0.35 * (nose.y < (ls.y + rs.y) / 2 ? 1 : 0.4)));
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const fs = feedback ? FOCUS_STYLES[feedback.focus] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 20px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>🎙️ SpeakForge</span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Live Coach</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600,
              background: status === "live" ? "#dcfce7" : status === "error" ? "#fee2e2" : "#f1f5f9",
              color: status === "live" ? "#15803d" : status === "error" ? "#dc2626" : "#64748b",
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
              {status === "live" ? "Live" : status === "error" ? "Permission denied" : "Starting..."}
            </span>
          </div>
        </div>

        {/* Planned speech */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px", marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
            📋 Planned Speech
            <span style={{ fontWeight: 400, color: "#94a3b8", marginLeft: 6 }}>Paste your script so AI can remind you of missing topics</span>
          </label>
          <textarea
            value={fullSpeech}
            onChange={e => setFullSpeech(e.target.value)}
            placeholder="Paste your full script here before presenting..."
            style={{
              width: "100%", height: 64, borderRadius: 8, border: "1px solid #e2e8f0",
              padding: "8px 12px", fontSize: 13, resize: "vertical",
              background: "#f8fafc", boxSizing: "border-box", color: "#0d1117",
            }}
          />
        </div>

        {/* Main grid: video | right panel */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, alignItems: "start" }}>

          {/* Video + controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <video
              ref={videoRef} playsInline muted
              style={{ width: "100%", borderRadius: 16, background: "#0f172a", display: "block", transform: "scaleX(-1)", aspectRatio: "16/9", objectFit: "cover" }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                style={{
                  flex: 1,
                  background: isRecording ? "#fee2e2" : "#dcfce7",
                  color: isRecording ? "#dc2626" : "#15803d",
                  border: `1.5px solid ${isRecording ? "#fca5a5" : "#86efac"}`,
                  borderRadius: 10,
                  padding: "10px 0",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {isRecording ? "⏹ Stop Recording" : "⏺ Start Recording"}
              </button>
              <button
                onClick={clearTranscript}
                style={{
                  background: "#f1f5f9",
                  color: "#64748b",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Right panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* AI Feedback card */}
            <div style={{
              borderRadius: 16, border: `1.5px solid ${fs ? fs.pill : "#e2e8f0"}`,
              background: fs ? fs.bg : "#fff", padding: "20px",
              transition: "background 0.5s, border-color 0.5s", minHeight: 120,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>
                  AI Coach
                </span>
                {feedback && fs && (
                  <span style={{ background: fs.pill, color: fs.accent, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                    {FOCUS_ICONS[feedback.focus]} {feedback.focus}
                  </span>
                )}
                <button
                  onClick={askCoach}
                  disabled={feedbackLoading}
                  style={{
                    marginLeft: "auto",
                    background: feedbackLoading ? "#f1f5f9" : "#3b5bdb",
                    color: feedbackLoading ? "#94a3b8" : "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: feedbackLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {feedbackLoading ? "Analyzing…" : "Ask Coach"}
                </button>
              </div>

              {feedbackError && (
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#dc2626", background: "#fee2e2", borderRadius: 8, padding: "6px 10px" }}>
                  ⚠ {feedbackError}
                </p>
              )}
              <p style={{
                margin: 0, fontSize: 20, fontWeight: 800, lineHeight: 1.3,
                color: fs ? fs.accent : "#94a3b8",
                transition: "color 0.5s",
              }}>
                {feedback
                  ? feedback.feedback
                  : status === "live"
                  ? "Press Ask Coach for feedback"
                  : "Waiting for camera…"}
              </p>

              {feedback?.reason && (
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                  {feedback.reason}
                </p>
              )}
            </div>

            {/* Metrics */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "16px 20px" }}>
              <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>
                Metrics
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
                {[
                  { label: "WPM", value: wpm, display: String(wpm), bar: clamp01(wpm / 180), color: "#3b82f6" },
                  { label: "Fillers", value: fillerCount, display: String(fillerCount), bar: clamp01(fillerCount / 10), color: "#f59e0b" },
                  { label: "Gesture", value: gestureEnergy, display: gestureEnergy.toFixed(2), bar: gestureEnergy, color: "#10b981" },
                  { label: "Posture", value: postureScore, display: postureScore.toFixed(2), bar: postureScore, color: "#6366f1" },
                  { label: "Energy", value: energyScore, display: energyScore.toFixed(2), bar: energyScore, color: "#8b5cf6" },
                  { label: "Variation", value: variationScore, display: variationScore.toFixed(2), bar: variationScore, color: "#06b6d4" },
                  { label: "Volume", value: volumeLevel, display: volumeLevel.toFixed(2), bar: volumeLevel, color: "#ec4899" },
                ].map(({ label, display, bar, color }) => (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "#64748b" }}>{label}</span>
                      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{display}</span>
                    </div>
                    <ScoreBar value={bar} color={color} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Transcripts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          {[
            { label: "Recent transcript", text: recentTranscript },
            { label: "Full transcript", text: transcript },
          ].map(({ label, text }) => (
            <div key={label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>
                {label}
              </p>
              <div style={{ fontSize: 13, color: text ? "#0d1117" : "#cbd5e1", lineHeight: 1.6, maxHeight: 120, overflow: "auto", whiteSpace: "pre-wrap" }}>
                {text || "(waiting…)"}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
