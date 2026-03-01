"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import Navbar from "../components/Navbar";
import Card from "../components/Card";
import Button from "../components/Button";

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

function ScoreBar({ value, color = "#7c6ff7" }: { value: number; color?: string }) {
  return (
    <div style={{ height: 5, background: "var(--surface2)", borderRadius: 99, overflow: "hidden", marginTop: 5 }}>
      <div style={{
        height: "100%",
        width: `${Math.round(value * 100)}%`,
        background: color,
        borderRadius: 99,
        transition: "width 0.4s ease",
      }} />
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
  const audioDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const volumeHistoryRef = useRef<number[]>([]);
  const audioRafRef = useRef<number | null>(null);
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
        const level = clamp01(Math.sqrt(sumSq / data.length) * 8);
        setVolumeLevel(level);
        setEnergyScore(p => clamp01(p * 0.6 + level * 0.4));

        const hist = volumeHistoryRef.current;
        hist.push(level);
        if (hist.length > 120) hist.shift();
        if (hist.length >= 10) {
          const recent = hist.slice(-20);
          const hi = Math.max(...recent), lo = Math.min(...recent);
          setVariationScore(clamp01((hi - lo) * 4));
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
      <div style={{ minHeight: "100vh", background: "var(--bg)", position: "relative" }}>
        <Navbar />

        {/* Sub-header */}
        <div style={{ borderBottom: "1px solid var(--border-light)", padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(247,250,252,0.8)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", position: "relative", zIndex: 1 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-0.6px", color: "var(--text)" }}>Session Summary</h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>SpeakForge · AI Coach</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>← Back</Button>
            <Button variant="primary" size="sm" onClick={restartSession}>↺ New Session</Button>
          </div>
        </div>

        <div style={{ padding: "32px 40px 60px", position: "relative", zIndex: 1 }}>
            <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Score banner */}
              {summaryLoading ? (
                <Card style={{ textAlign: "center", color: "var(--text-subtle)", fontSize: 14, padding: "32px" }}>
                  ✨ Generating your personalized summary…
                </Card>
              ) : summaryResult && (
                <Card className="anim-scaleIn">
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>AI Overview</p>
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "var(--text)" }}>{summaryResult.overview}</p>
                    </div>
                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                      <div style={{
                        fontSize: 52,
                        fontWeight: 900,
                        letterSpacing: "-2px",
                        color: summaryResult.score >= 70 ? "#15803d" : summaryResult.score >= 45 ? "#b45309" : "#dc2626",
                      }}>
                        {summaryResult.score}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-subtle)", fontWeight: 600 }}>/ 100</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
                    <div style={{ background: "#f0fdf4", borderRadius: "var(--radius-sm)", padding: "14px 16px" }}>
                      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#15803d" }}>✅ Strengths</p>
                      {summaryResult.strengths.map((str, i) => (
                        <p key={i} style={{ margin: "3px 0", fontSize: 13, color: "#166534" }}>• {str}</p>
                      ))}
                    </div>
                    <div style={{ background: "#fff7ed", borderRadius: "var(--radius-sm)", padding: "14px 16px" }}>
                      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#c2410c" }}>🎯 Improve</p>
                      {summaryResult.improvements.map((imp, i) => (
                        <p key={i} style={{ margin: "3px 0", fontSize: 13, color: "#9a3412" }}>• {imp}</p>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {/* Session stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { label: "Duration", value: `${mins}:${String(secs).padStart(2, "0")}` },
                  { label: "Words",    value: String(s.wordCount) },
                  { label: "Avg WPM",  value: String(m.wpm) },
                  { label: "Fillers",  value: String(s.fillerCount) },
                ].map(({ label, value }) => (
                  <Card key={label} hoverable style={{ textAlign: "center", padding: "18px 16px" }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.5px" }}>{value}</div>
                    <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 4, fontWeight: 500 }}>{label}</div>
                  </Card>
                ))}
              </div>

              {/* Avg metrics */}
              <Card>
                <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>Average Metrics</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 28px" }}>
                  {[
                    { label: "Gesture Energy", value: m.gestureEnergy,  color: "#10b981" },
                    { label: "Posture",         value: m.postureScore,   color: "#7c6ff7" },
                    { label: "Energy",          value: m.energyScore,    color: "#8b5cf6" },
                    { label: "Variation",       value: m.variationScore, color: "#06b6d4" },
                    { label: "Volume",          value: m.volumeLevel,    color: "#ec4899" },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{value.toFixed(2)}</span>
                      </div>
                      <ScoreBar value={value} color={color} />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Transcript */}
              <Card>
                <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>Full Transcript</p>
                <div style={{
                  fontSize: 14,
                  color: s.transcript ? "var(--text)" : "var(--text-subtle)",
                  lineHeight: 1.75,
                  whiteSpace: "pre-wrap",
                  maxHeight: 240,
                  overflow: "auto",
                }}>
                  {s.transcript || "(no transcript recorded)"}
                </div>
              </Card>

              {/* Bottom buttons */}
              <div style={{ display: "flex", gap: 12, justifyContent: "center", paddingTop: 4 }}>
                <Button variant="ghost" size="md" onClick={() => router.push("/")}>← Back to Home</Button>
                <Button variant="primary" size="md" onClick={restartSession}>↺ Start New Session</Button>
              </div>

            </div>
        </div>
      </div>
    );
  }

  // ── Render: Live coach ────────────────────────────────────────────────────
  const fs = feedback ? FOCUS_STYLES[feedback.focus] : null;

  const statusColor = status === "live" ? "#22c55e" : status === "error" ? "#ef4444" : "#94a3b8";
  const statusLabel = status === "live" ? "Live" : status === "error" ? "Permission denied" : "Starting…";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", position: "relative" }}>
      <div className="bg-blobs" aria-hidden><div className="bg-blob-bottom" /></div>
      <Navbar />

      {/* Sub-header */}
      <div style={{ borderBottom: "1px solid var(--border-light)", padding: "16px 40px", display: "flex", alignItems: "center", gap: 14, background: "rgba(247,250,252,0.8)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", position: "relative", zIndex: 1 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-0.6px", color: "var(--text)" }}>Live Coach</h1>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12, fontWeight: 600, color: statusColor,
        }}>
          <span className={status === "live" ? "live-dot" : undefined} style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, display: "inline-block" }} />
          {statusLabel}
        </span>
      </div>

      <div style={{ padding: "20px 40px 48px", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Planned speech */}
            <Card style={{ padding: "16px 20px" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                📋 Planned Speech
                <span style={{ fontWeight: 400, color: "var(--text-subtle)", marginLeft: 8, fontSize: 12 }}>
                  Paste your script so AI can remind you of missing topics
                </span>
              </label>
              <textarea
                value={fullSpeech}
                onChange={e => setFullSpeech(e.target.value)}
                placeholder="Paste your full script here before presenting…"
                style={{
                  width: "100%",
                  height: 60,
                  borderRadius: "var(--radius-sm)",
                  border: "1.5px solid var(--border)",
                  padding: "8px 12px",
                  fontSize: 13,
                  resize: "vertical",
                  background: "var(--bg)",
                  boxSizing: "border-box",
                  color: "var(--text)",
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border-color 0.15s ease",
                }}
                onFocus={e => (e.target.style.borderColor = "var(--accent)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")}
              />
            </Card>

            {/* Main grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 370px", gap: 14, alignItems: "start" }}>

              {/* Left: Video + controls */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{
                  borderRadius: "var(--radius-xl)",
                  overflow: "hidden",
                  boxShadow: "var(--shadow-md)",
                  background: "#0f172a",
                  lineHeight: 0,
                }}>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{
                      width: "100%",
                      display: "block",
                      transform: "scaleX(-1)",
                      aspectRatio: "16/9",
                      objectFit: "cover",
                    }}
                  />
                </div>

                {/* Record + Clear buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                  <Button
                    variant={isRecording ? "danger" : "primary"}
                    onClick={isRecording ? stopRecording : startRecording}
                    style={{ flex: 1, padding: "11px 0" }}
                  >
                    {isRecording ? "⏹ Stop & Summarize" : "⏺ Start Recording"}
                  </Button>
                  <Button variant="ghost" onClick={clearTranscript}>Clear</Button>
                </div>
              </div>

              {/* Right panel */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* AI Feedback card */}
                <div
                  style={{
                    borderRadius: "var(--radius-lg)",
                    border: `1.5px solid ${fs ? fs.pill : "var(--border-light)"}`,
                    background: fs ? fs.bg : "var(--surface)",
                    padding: "20px",
                    boxShadow: "var(--shadow-sm)",
                    transition: "background 0.5s, border-color 0.5s",
                    minHeight: 128,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>
                      AI Coach
                    </span>
                    {feedback && fs && (
                      <span style={{
                        background: fs.pill,
                        color: fs.accent,
                        borderRadius: "var(--radius-pill)",
                        padding: "2px 10px",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}>
                        {FOCUS_ICONS[feedback.focus]} {feedback.focus}
                      </span>
                    )}
                    <Button
                      variant={feedbackLoading ? "ghost" : "primary"}
                      size="sm"
                      onClick={askCoach}
                      disabled={feedbackLoading}
                      style={{ marginLeft: "auto", padding: "5px 14px", fontSize: 12 }}
                    >
                      {feedbackLoading ? "Analyzing…" : "Ask Coach"}
                    </Button>
                  </div>

                  {feedbackError && (
                    <p style={{
                      margin: "0 0 10px",
                      fontSize: 12,
                      color: "#dc2626",
                      background: "#fee2e2",
                      borderRadius: "var(--radius-xs)",
                      padding: "7px 12px",
                    }}>
                      ⚠ {feedbackError}
                    </p>
                  )}
                  <p style={{
                    margin: 0,
                    fontSize: 19,
                    fontWeight: 800,
                    lineHeight: 1.35,
                    color: fs ? fs.accent : "var(--text-subtle)",
                    transition: "color 0.5s",
                  }}>
                    {feedback ? feedback.feedback : status === "live" ? "Press Ask Coach for feedback" : "Waiting for camera…"}
                  </p>
                  {feedback?.reason && (
                    <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55 }}>
                      {feedback.reason}
                    </p>
                  )}
                </div>

                {/* Metrics card */}
                <Card style={{ padding: "18px 20px" }}>
                  <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>
                    Live Metrics
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "13px 22px" }}>
                    {[
                      { label: "WPM",       display: String(wpm),                  bar: clamp01(wpm / 180),  color: "#3b82f6" },
                      { label: "Fillers",   display: String(fillerCount),          bar: clamp01(fillerCount / 10), color: "#f59e0b" },
                      { label: "Gesture",   display: gestureEnergy.toFixed(2),    bar: gestureEnergy,        color: "#10b981" },
                      { label: "Posture",   display: postureScore.toFixed(2),     bar: postureScore,         color: "#7c6ff7" },
                      { label: "Energy",    display: energyScore.toFixed(2),      bar: energyScore,          color: "#8b5cf6" },
                      { label: "Variation", display: variationScore.toFixed(2),   bar: variationScore,       color: "#06b6d4" },
                      { label: "Volume",    display: volumeLevel.toFixed(2),      bar: volumeLevel,          color: "#ec4899" },
                    ].map(({ label, display, bar, color }) => (
                      <div key={label}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
                          <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--text)" }}>{display}</span>
                        </div>
                        <ScoreBar value={bar} color={color} />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            {/* Transcripts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Recent", text: recentTranscript },
                { label: "Full Transcript", text: transcript },
              ].map(({ label, text }) => (
                <Card key={label} style={{ padding: "16px 18px" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>
                    {label}
                  </p>
                  <div style={{
                    fontSize: 13,
                    color: text ? "var(--text)" : "var(--text-subtle)",
                    lineHeight: 1.65,
                    maxHeight: 110,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                  }}>
                    {text || "(waiting…)"}
                  </div>
                </Card>
              ))}
            </div>

          </div>
      </div>
    </div>
  );
}
