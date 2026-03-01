"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// ── Types & constants ────────────────────────────────────────────────────────

type FocusType = "pace" | "fillers" | "energy" | "variation" | "gestures" | "posture" | "content";

interface GeminiFeedback { feedback: string; focus: FocusType; reason: string; }

interface SummaryResult { overview: string; score: number; strengths: string[]; improvements: string[]; }

interface MetricsSnapshot {
  wpm: number; fillerCount: number; gestureEnergy: number;
  postureScore: number; volumeLevel: number; energyScore: number; variationScore: number;
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

function avg(arr: number[]) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

function ScoreBar({ value, color = "#6d28d9" }: { value: number; color?: string }) {
  return (
    <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden", marginTop: 4 }}>
      <div style={{ height: "100%", width: `${Math.round(value * 100)}%`, background: color, borderRadius: 99, transition: "width 0.4s ease" }} />
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CoachPage() {
  const router = useRouter();

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
  const sustainedVolumeRef = useRef(0);
  const sustainedEnergyRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  // Metrics history (snapshot every 5s while recording)
  const metricsHistoryRef = useRef<MetricsSnapshot[]>([]);
  const sessionStartRef = useRef<number | null>(null);

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

  // User session
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.name) setUser(d); });
  }, []);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  // Gemini state
  const [fullSpeech, setFullSpeech] = useState("");
  const [feedback, setFeedback] = useState<GeminiFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Summary state
  const [showSummary, setShowSummary] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [summarySnapshot, setSummarySnapshot] = useState<{
    transcript: string; durationSecs: number; wordCount: number;
    fillerCount: number; avgMetrics: MetricsSnapshot;
  } | null>(null);

  // Stable refs to avoid stale closures
  const metricsRef = useRef<MetricsSnapshot>({ wpm: 0, fillerCount: 0, gestureEnergy: 0, postureScore: 0, volumeLevel: 0, energyScore: 0, variationScore: 0 });
  const transcriptRef = useRef("");
  const recentTranscriptRef = useRef("");
  const fullSpeechRef = useRef("");
  const isLiveRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    metricsRef.current = { wpm, fillerCount, gestureEnergy, postureScore, volumeLevel, energyScore, variationScore };
  }, [wpm, fillerCount, gestureEnergy, postureScore, volumeLevel, energyScore, variationScore]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { recentTranscriptRef.current = recentTranscript; }, [recentTranscript]);
  useEffect(() => { fullSpeechRef.current = fullSpeech; }, [fullSpeech]);
  useEffect(() => { isLiveRef.current = status === "live"; }, [status]);
  useEffect(() => { startedAtRef.current = startedAt; }, [startedAt]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  // Collect metrics snapshot every 5s while recording
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      metricsHistoryRef.current.push({ ...metricsRef.current });
    }, 5000);
    return () => clearInterval(id);
  }, [isRecording]);

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
      if (data.feedback && data.focus) setFeedback(data as GeminiFeedback);
      else setFeedbackError("Unexpected response from coach.");
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
        audioDataRef.current = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>;
        setStatus("live");
      } catch { setStatus("error"); }
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
        // ×14 sensitivity: normal speech hits 0.4–0.7, yelling 0.9+
        const rawLevel = clamp01(Math.sqrt(sumSq / data.length) * 14);

        // Fast attack, slow decay — holds the reading through natural pauses
        const speaking = rawLevel > 0.04;
        sustainedVolumeRef.current = speaking
          ? clamp01(sustainedVolumeRef.current * 0.3 + rawLevel * 0.7)
          : clamp01(sustainedVolumeRef.current * 0.90);
        sustainedEnergyRef.current = speaking
          ? clamp01(sustainedEnergyRef.current * 0.4 + rawLevel * 0.6)
          : clamp01(sustainedEnergyRef.current * 0.93);
        setVolumeLevel(sustainedVolumeRef.current);
        setEnergyScore(sustainedEnergyRef.current);

        const hist = volumeHistoryRef.current;
        hist.push(rawLevel);
        if (hist.length > 120) hist.shift();
        // Variation = dynamic range of recent ~40 frames (~670 ms), scaled up
        if (hist.length >= 10) {
          const recent = hist.slice(-40);
          const hi = Math.max(...recent), lo = Math.min(...recent);
          setVariationScore(clamp01((hi - lo) * 6));
        }
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
    rec.onend = () => { if (isRecordingRef.current) rec.start(); };
    recRef.current = rec;
    return () => { rec.stop(); recRef.current = null; };
  }, [SpeechRecognition]);

  // ── Recording handlers ────────────────────────────────────────────────────
  const startRecording = () => {
    if (!recRef.current || isRecordingRef.current) return;
    metricsHistoryRef.current = [];
    sessionStartRef.current = Date.now();
    setIsRecording(true);
    recRef.current.start();
  };

  const stopRecording = async () => {
    if (!recRef.current || !isRecordingRef.current) return;
    setIsRecording(false);
    isRecordingRef.current = false;
    recRef.current.stop();

    // Capture session snapshot
    const durationSecs = sessionStartRef.current ? (Date.now() - sessionStartRef.current) / 1000 : 0;
    const hist = metricsHistoryRef.current;
    const snap = {
      transcript: transcriptRef.current,
      durationSecs,
      wordCount: transcriptRef.current.split(/\s+/).filter(Boolean).length,
      fillerCount: countFillers(transcriptRef.current),
      avgMetrics: {
        wpm: hist.length ? Math.round(avg(hist.map(h => h.wpm))) : metricsRef.current.wpm,
        fillerCount: hist.length ? Math.round(avg(hist.map(h => h.fillerCount))) : metricsRef.current.fillerCount,
        gestureEnergy: hist.length ? avg(hist.map(h => h.gestureEnergy)) : metricsRef.current.gestureEnergy,
        postureScore: hist.length ? avg(hist.map(h => h.postureScore)) : metricsRef.current.postureScore,
        volumeLevel: hist.length ? avg(hist.map(h => h.volumeLevel)) : metricsRef.current.volumeLevel,
        energyScore: hist.length ? avg(hist.map(h => h.energyScore)) : metricsRef.current.energyScore,
        variationScore: hist.length ? avg(hist.map(h => h.variationScore)) : metricsRef.current.variationScore,
      },
    };
    setSummarySnapshot(snap);
    setShowSummary(true);

    // Call summary AI
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...snap, fullSpeech: fullSpeechRef.current }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryResult(data);
      }
    } catch (e) { console.error("Summary error:", e); }
    finally { setSummaryLoading(false); }
  };

  const clearTranscript = () => {
    setTranscript(""); setRecentTranscript(""); setStartedAt(null); setWpm(0); setFillerCount(0);
    if (isRecordingRef.current && recRef.current) recRef.current.stop();
  };

  const restartSession = () => {
    setShowSummary(false); setSummaryResult(null); setSummarySnapshot(null);
    setTranscript(""); setRecentTranscript(""); setStartedAt(null);
    setWpm(0); setFillerCount(0); setFeedback(null); setFeedbackError(null);
    metricsHistoryRef.current = []; sessionStartRef.current = null;
  };

  // ── WPM + filler counter ──────────────────────────────────────────────────
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => {
      const secs = (Date.now() - startedAt) / 1000;
      // Include interim words so WPM doesn't lag behind finalized results
      const combined = (transcriptRef.current + " " + recentTranscriptRef.current).trim();
      setWpm(estimateWpm(combined.split(/\s+/).filter(Boolean).length, secs));
      setFillerCount(countFillers(transcriptRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

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

  // ── Render: Summary page ──────────────────────────────────────────────────
  if (showSummary && summarySnapshot) {
    const s = summarySnapshot;
    const m = s.avgMetrics;
    const mins = Math.floor(s.durationSecs / 60), secs = Math.round(s.durationSecs % 60);

    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 20px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>🎙️ SpeakForge</span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Session Summary</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => router.push("/")} style={{ background: "#f1f5f9", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                ← Back
              </button>
              <button onClick={restartSession} style={{ background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                ↺ New Session
              </button>
            </div>
          </div>

          {/* Score banner */}
          {summaryLoading ? (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "28px", textAlign: "center", marginBottom: 16, color: "#94a3b8", fontSize: 14 }}>
              ✨ Generating your personalized summary…
            </div>
          ) : summaryResult && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "24px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>AI Overview</p>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#0d1117" }}>{summaryResult.overview}</p>
                </div>
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 48, fontWeight: 900, color: summaryResult.score >= 70 ? "#15803d" : summaryResult.score >= 45 ? "#b45309" : "#dc2626", letterSpacing: "-2px" }}>
                    {summaryResult.score}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>/ 100</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#15803d" }}>✅ Strengths</p>
                  {summaryResult.strengths.map((s, i) => <p key={i} style={{ margin: "2px 0", fontSize: 13, color: "#166534" }}>• {s}</p>)}
                </div>
                <div style={{ background: "#fff7ed", borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#c2410c" }}>🎯 Improve</p>
                  {summaryResult.improvements.map((s, i) => <p key={i} style={{ margin: "2px 0", fontSize: 13, color: "#9a3412" }}>• {s}</p>)}
                </div>
              </div>
            </div>
          )}

          {/* Session stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Duration", value: `${mins}:${String(secs).padStart(2, "0")}` },
              { label: "Words", value: String(s.wordCount) },
              { label: "Avg WPM", value: String(m.wpm) },
              { label: "Fillers", value: String(s.fillerCount) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0d1117" }}>{value}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Avg metrics */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
            <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>Average Metrics</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
              {[
                { label: "Gesture Energy", value: m.gestureEnergy, color: "#10b981" },
                { label: "Posture", value: m.postureScore, color: "#6366f1" },
                { label: "Energy", value: m.energyScore, color: "#8b5cf6" },
                { label: "Variation", value: m.variationScore, color: "#06b6d4" },
                { label: "Volume", value: m.volumeLevel, color: "#ec4899" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#64748b" }}>{label}</span>
                    <span style={{ fontWeight: 700 }}>{value.toFixed(2)}</span>
                  </div>
                  <ScoreBar value={value} color={color} />
                </div>
              ))}
            </div>
          </div>

          {/* Transcript */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px", marginBottom: 24 }}>
            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>Full Transcript</p>
            <div style={{ fontSize: 14, color: s.transcript ? "#0d1117" : "#cbd5e1", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 240, overflow: "auto" }}>
              {s.transcript || "(no transcript recorded)"}
            </div>
          </div>

          {/* Bottom buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => router.push("/")} style={{ background: "#f1f5f9", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              ← Back to Home
            </button>
            <button onClick={restartSession} style={{ background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              ↺ Start New Session
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ── Render: Live coach ────────────────────────────────────────────────────
  const fs = feedback ? FOCUS_STYLES[feedback.focus] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 20px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.push("/")} style={{ background: "none", border: "none", fontSize: 13, color: "#94a3b8", cursor: "pointer", padding: 0 }}>← Home</button>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>🎙️ SpeakForge</span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Live Coach</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user && (
              <span style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>
                Hi, {user.name}
              </span>
            )}
            <span style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600,
              background: status === "live" ? "#dcfce7" : status === "error" ? "#fee2e2" : "#f1f5f9",
              color: status === "live" ? "#15803d" : status === "error" ? "#dc2626" : "#64748b",
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
              {status === "live" ? "Live" : status === "error" ? "Permission denied" : "Starting..."}
            </span>
            <button onClick={signOut} style={{ background: "#f1f5f9", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Sign Out
            </button>
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
            style={{ width: "100%", height: 64, borderRadius: 8, border: "1px solid #e2e8f0", padding: "8px 12px", fontSize: 13, resize: "vertical", background: "#f8fafc", boxSizing: "border-box", color: "#0d1117" }}
          />
        </div>

        {/* Main grid */}
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
                  borderRadius: 10, padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {isRecording ? "⏹ Stop & Summarize" : "⏺ Start Recording"}
              </button>
              <button
                onClick={clearTranscript}
                style={{ background: "#f1f5f9", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
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
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>AI Coach</span>
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
                    border: "none", borderRadius: 8, padding: "5px 12px",
                    fontSize: 12, fontWeight: 700, cursor: feedbackLoading ? "not-allowed" : "pointer",
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
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, lineHeight: 1.3, color: fs ? fs.accent : "#94a3b8", transition: "color 0.5s" }}>
                {feedback ? feedback.feedback : status === "live" ? "Press Ask Coach for feedback" : "Waiting for camera…"}
              </p>
              {feedback?.reason && (
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{feedback.reason}</p>
              )}
            </div>

            {/* Metrics */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "16px 20px" }}>
              <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>Metrics</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
                {[
                  { label: "WPM", display: String(wpm), bar: clamp01(wpm / 180), color: "#3b82f6" },
                  { label: "Fillers", display: String(fillerCount), bar: clamp01(fillerCount / 10), color: "#f59e0b" },
                  { label: "Gesture", display: gestureEnergy.toFixed(2), bar: gestureEnergy, color: "#10b981" },
                  { label: "Posture", display: postureScore.toFixed(2), bar: postureScore, color: "#6366f1" },
                  { label: "Energy", display: energyScore.toFixed(2), bar: energyScore, color: "#8b5cf6" },
                  { label: "Variation", display: variationScore.toFixed(2), bar: variationScore, color: "#06b6d4" },
                  { label: "Volume", display: volumeLevel.toFixed(2), bar: volumeLevel, color: "#ec4899" },
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
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>{label}</p>
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
