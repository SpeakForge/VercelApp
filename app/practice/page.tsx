"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// ── Types ────────────────────────────────────────────────────────────────────

type FocusType = "pace" | "fillers" | "energy" | "variation" | "gestures" | "posture" | "content";
type PracticePhase = "loading" | "listen" | "record" | "review" | "complete";

interface MetricsSnapshot {
  wpm: number; fillerCount: number; gestureEnergy: number;
  postureScore: number; volumeLevel: number; energyScore: number; variationScore: number;
}

interface PracticeSegment {
  order: number; focus: FocusType; title: string;
  coachIntro: string; practiceText: string; tip: string;
}

interface PracticeSession { sessionTitle: string; overview: string; segments: PracticeSegment[]; }

interface SegmentResult {
  segmentIdx: number; transcript: string; wpm: number;
  fillerCount: number; avgMetrics: MetricsSnapshot;
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function PracticePage() {
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

  // Coach audio playback
  const coachAudioRef = useRef<HTMLAudioElement | null>(null);

  // Recording
  const recRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const metricsHistoryRef = useRef<MetricsSnapshot[]>([]);
  const sessionStartRef = useRef<number | null>(null);

  // Practice state
  const [phase, setPhase] = useState<PracticePhase>("loading");
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [currentSegmentIdx, setCurrentSegmentIdx] = useState(0);
  const [segmentResults, setSegmentResults] = useState<SegmentResult[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [camStatus, setCamStatus] = useState<"loading" | "live" | "error">("loading");
  const [user, setUser] = useState<{ name: string } | null>(null);

  // Metrics state
  const [wpm, setWpm] = useState(0);
  const [fillerCount, setFillerCount] = useState(0);
  const [gestureEnergy, setGestureEnergy] = useState(0);
  const [postureScore, setPostureScore] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [energyScore, setEnergyScore] = useState(0);
  const [variationScore, setVariationScore] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [recentTranscript, setRecentTranscript] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // Stable refs
  const metricsRef = useRef<MetricsSnapshot>({ wpm: 0, fillerCount: 0, gestureEnergy: 0, postureScore: 0, volumeLevel: 0, energyScore: 0, variationScore: 0 });
  const transcriptRef = useRef("");
  const recentTranscriptRef = useRef("");

  useEffect(() => {
    metricsRef.current = { wpm, fillerCount, gestureEnergy, postureScore, volumeLevel, energyScore, variationScore };
  }, [wpm, fillerCount, gestureEnergy, postureScore, volumeLevel, energyScore, variationScore]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { recentTranscriptRef.current = recentTranscript; }, [recentTranscript]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  // Metrics snapshot every 5s during recording
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => { metricsHistoryRef.current.push({ ...metricsRef.current }); }, 5000);
    return () => clearInterval(id);
  }, [isRecording]);

  // Load user + generate practice session on mount
  const loadPracticeSession = (forceRefresh = false) => {
    const CACHE_KEY = "speakforge_practice_session";
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { session, generatedAt } = JSON.parse(cached);
          if (Date.now() - generatedAt < CACHE_TTL_MS && session?.segments?.length) {
            setPracticeSession(session);
            setPhase("listen");
            return;
          }
        }
      } catch { /* ignore parse errors */ }
    }

    setPhase("loading");
    fetch("/api/practice/generate")
      .then(r => r.ok ? r.json() : Promise.reject("Failed to generate"))
      .then(data => {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ session: data, generatedAt: Date.now() })); } catch { /* storage full */ }
        setPracticeSession(data);
        setPhase("listen");
      })
      .catch(() => setGenError("Couldn't generate your practice session. Please try again."));
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.name) setUser(d); });

    loadPracticeSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Camera + audio setup
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
        setCamStatus("live");
      } catch { setCamStatus("error"); }
    })();
    return () => {
      if (audioRafRef.current) cancelAnimationFrame(audioRafRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  // Audio analysis loop
  useEffect(() => {
    const tick = () => {
      const analyser = analyserRef.current, data = audioDataRef.current;
      if (analyser && data) {
        analyser.getByteTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sumSq += v * v; }
        const rawLevel = clamp01(Math.sqrt(sumSq / data.length) * 14);
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

  // Speech recognition
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
      // Update refs immediately (before render) so WPM interval never reads stale data
      transcriptRef.current = finalFull.trim();
      recentTranscriptRef.current = interim;
      setTranscript(finalFull.trim());
      setRecentTranscript(interim);
      // Instant WPM on every speech event — no 1-second lag
      if (sessionStartRef.current) {
        const secs = (Date.now() - sessionStartRef.current) / 1000;
        const combined = (finalFull.trim() + " " + interim).trim();
        setWpm(estimateWpm(combined.split(/\s+/).filter(Boolean).length, secs));
        setFillerCount(countFillers(finalFull.trim()));
      }
    };
    rec.onend = () => { if (isRecordingRef.current) rec.start(); };
    recRef.current = rec;
    return () => { rec.stop(); recRef.current = null; };
  }, [SpeechRecognition]);

  // WPM counter (only active during record phase)
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => {
      const secs = (Date.now() - startedAt) / 1000;
      const combined = (transcriptRef.current + " " + recentTranscriptRef.current).trim();
      setWpm(estimateWpm(combined.split(/\s+/).filter(Boolean).length, secs));
      setFillerCount(countFillers(transcriptRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // Pose detection setup
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

  // ── TTS ───────────────────────────────────────────────────────────────────────

  const stopCoachAudio = () => {
    const audio = coachAudioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    setAudioPlaying(false);
  };

  const playCoachAudio = async (text: string) => {
    if (audioLoading || audioPlaying) return;
    setAudioLoading(true);
    try {
      const r = await fetch("/api/practice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error("TTS failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = coachAudioRef.current;
      if (audio) {
        audio.src = url;
        audio.onended = () => setAudioPlaying(false);
        await audio.play();
        setAudioPlaying(true);
      }
    } catch (e) {
      console.error("TTS error:", e);
    } finally {
      setAudioLoading(false);
    }
  };

  // ── Recording ─────────────────────────────────────────────────────────────────

  const startRecording = () => {
    if (!recRef.current || isRecordingRef.current) return;
    metricsHistoryRef.current = [];
    sessionStartRef.current = Date.now();
    setTranscript(""); setRecentTranscript(""); setStartedAt(Date.now());
    setWpm(0); setFillerCount(0);
    setIsRecording(true);
    recRef.current.start();
    setPhase("record");
  };

  const stopRecording = () => {
    if (!recRef.current || !isRecordingRef.current) return;
    setIsRecording(false);
    isRecordingRef.current = false;
    recRef.current.stop();

    const hist = metricsHistoryRef.current;
    const result: SegmentResult = {
      segmentIdx: currentSegmentIdx,
      transcript: transcriptRef.current,
      wpm: hist.length ? Math.round(avg(hist.map(h => h.wpm))) : metricsRef.current.wpm,
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
    setSegmentResults(prev => [...prev, result]);
    setPhase("review");
  };

  const nextSegment = (latestResults: SegmentResult[]) => {
    const segments = practiceSession?.segments ?? [];
    if (currentSegmentIdx + 1 >= segments.length) {
      // Save practice session to DB
      const overallAvg: MetricsSnapshot = {
        wpm: Math.round(avg(latestResults.map(r => r.avgMetrics.wpm))),
        fillerCount: Math.round(avg(latestResults.map(r => r.fillerCount))),
        gestureEnergy: avg(latestResults.map(r => r.avgMetrics.gestureEnergy)),
        postureScore: avg(latestResults.map(r => r.avgMetrics.postureScore)),
        volumeLevel: avg(latestResults.map(r => r.avgMetrics.volumeLevel)),
        energyScore: avg(latestResults.map(r => r.avgMetrics.energyScore)),
        variationScore: avg(latestResults.map(r => r.avgMetrics.variationScore)),
      };
      fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationSecs: latestResults.length * 90,
          wordCount: latestResults.reduce((a, r) => a + r.transcript.split(/\s+/).filter(Boolean).length, 0),
          fillerCount: latestResults.reduce((a, r) => a + r.fillerCount, 0),
          transcript: latestResults.map((r, i) => `[Segment ${i + 1}] ${r.transcript}`).join("\n"),
          plannedSpeech: segments.map(s => s.practiceText).join("\n"),
          avgMetrics: overallAvg,
          summary: null,
          lastFeedback: null,
          isPracticeSession: true,
          sessionTitle: practiceSession?.sessionTitle,
        }),
      }).catch(console.error);
      setPhase("complete");
    } else {
      setCurrentSegmentIdx(prev => prev + 1);
      setPhase("listen");
    }
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const seg = practiceSession?.segments?.[currentSegmentIdx];
  const fs = seg ? FOCUS_STYLES[seg.focus] : null;
  const lastResult = segmentResults[segmentResults.length - 1];

  // ── Loading screen ────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-geist-sans), -apple-system, sans-serif", color: "#0d1117" }}>
        {genError ? (
          <div style={{ textAlign: "center", maxWidth: 400 }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
            <p style={{ color: "#dc2626", marginBottom: 20, fontSize: 15 }}>{genError}</p>
            <button onClick={() => router.push("/")} style={{ background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>← Back to Home</button>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🧠</div>
            <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Analyzing your history…</p>
            <p style={{ fontSize: 14, color: "#94a3b8" }}>Building a personalized practice session just for you</p>
          </div>
        )}
      </div>
    );
  }

  // ── Complete screen ───────────────────────────────────────────────────────────

  if (phase === "complete") {
    const overallWpm = segmentResults.length ? Math.round(avg(segmentResults.map(r => r.wpm))) : 0;
    const overallFillers = segmentResults.reduce((a, r) => a + r.fillerCount, 0);
    const overallEnergy = avg(segmentResults.map(r => r.avgMetrics.energyScore));
    const overallVolume = avg(segmentResults.map(r => r.avgMetrics.volumeLevel));

    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 20px", fontFamily: "var(--font-geist-sans), -apple-system, sans-serif" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px" }}>🎙️ SpeakForge</span>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => router.push("/coach")} style={{ background: "#f1f5f9", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Coach Mode</button>
              <button onClick={() => router.push("/")} style={{ background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Home</button>
            </div>
          </div>

          {/* Banner */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: "32px", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: "#0d1117", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Practice Complete!</h2>
            <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>{practiceSession?.sessionTitle}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, maxWidth: 520, margin: "0 auto" }}>
              {[
                { label: "Segments", value: String(segmentResults.length), color: "#3b5bdb" },
                { label: "Avg WPM", value: String(overallWpm), color: "#3b82f6" },
                { label: "Fillers", value: String(overallFillers), color: "#f59e0b" },
                { label: "Energy", value: overallEnergy.toFixed(2), color: "#8b5cf6" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 10px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Per-segment results */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>Segment Breakdown</p>
            {segmentResults.map((r, i) => {
              const s = practiceSession?.segments?.[r.segmentIdx];
              const sfs = s ? FOCUS_STYLES[s.focus] : null;
              return (
                <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ background: sfs?.pill, color: sfs?.accent, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                      {s ? FOCUS_ICONS[s.focus] : ""} {s?.focus}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0d1117" }}>{s?.title}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                    {[
                      { label: "WPM", value: String(r.wpm), color: "#3b82f6" },
                      { label: "Fillers", value: String(r.fillerCount), color: "#f59e0b" },
                      { label: "Energy", value: r.avgMetrics.energyScore.toFixed(2), color: "#8b5cf6" },
                      { label: "Volume", value: r.avgMetrics.volumeLevel.toFixed(2), color: "#ec4899" },
                      { label: "Posture", value: r.avgMetrics.postureScore.toFixed(2), color: "#6366f1" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {r.transcript && (
                    <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>"{r.transcript.slice(0, 120)}{r.transcript.length > 120 ? "…" : ""}"</p>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => { setSegmentResults([]); setCurrentSegmentIdx(0); loadPracticeSession(true); }} style={{ background: "#f1f5f9", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              ↺ New Practice Session
            </button>
            <button onClick={() => router.push("/coach")} style={{ background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Go to Coach Mode →
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ── Main practice UI ──────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 20px", fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <audio ref={coachAudioRef} style={{ display: "none" }} />
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.push("/")} style={{ background: "none", border: "none", fontSize: 13, color: "#94a3b8", cursor: "pointer", padding: 0 }}>← Home</button>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>🎙️ SpeakForge</span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Practice Mode</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user && <span style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>Hi, {user.name}</span>}
            <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: camStatus === "live" ? "#dcfce7" : "#f1f5f9", color: camStatus === "live" ? "#15803d" : "#64748b" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
              {camStatus === "live" ? "Live" : "Starting…"}
            </span>
            <button onClick={() => { setSegmentResults([]); setCurrentSegmentIdx(0); loadPracticeSession(true); }} style={{ background: "#f1f5f9", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↺ Regenerate</button>
            <button onClick={() => router.push("/coach")} style={{ background: "#f1f5f9", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Coach Mode</button>
            <button onClick={signOut} style={{ background: "#f1f5f9", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Sign Out</button>
          </div>
        </div>

        {/* Roadmap stepper */}
        {practiceSession && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 24px", marginBottom: 16 }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>
              {practiceSession.sessionTitle}
            </p>
            <div style={{ display: "flex", alignItems: "center" }}>
              {practiceSession.segments.map((s, i) => {
                const done = segmentResults.some(r => r.segmentIdx === i);
                const active = i === currentSegmentIdx && !done;
                const sfs = FOCUS_STYLES[s.focus];
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%",
                        background: done ? "#3b5bdb" : active ? sfs.pill : "#f1f5f9",
                        color: done ? "#fff" : active ? sfs.accent : "#94a3b8",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: done ? 13 : 16, fontWeight: 700,
                        border: active ? `2px solid ${sfs.accent}` : "2px solid transparent",
                        transition: "all 0.3s",
                      }}>
                        {done ? "✓" : FOCUS_ICONS[s.focus]}
                      </div>
                      <span style={{ fontSize: 10, color: active ? sfs.accent : done ? "#3b5bdb" : "#94a3b8", marginTop: 5, fontWeight: active || done ? 700 : 400, textAlign: "center", maxWidth: 70 }}>
                        {s.title}
                      </span>
                    </div>
                    {i < practiceSession.segments.length - 1 && (
                      <div style={{ height: 2, flex: 0.4, background: done ? "#3b5bdb" : "#e2e8f0", marginBottom: 20, transition: "background 0.3s" }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, alignItems: "start" }}>

          {/* Left: Video + controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <video ref={videoRef} playsInline muted
              style={{ width: "100%", borderRadius: 16, background: "#0f172a", display: "block", transform: "scaleX(-1)", aspectRatio: "16/9", objectFit: "cover" }}
            />

            {/* Phase action buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              {phase === "listen" && (
                <>
                  <button
                    onClick={() => seg && playCoachAudio(seg.coachIntro + " " + seg.practiceText)}
                    disabled={audioLoading || audioPlaying}
                    style={{
                      flex: 1, borderRadius: 10, padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: audioLoading || audioPlaying ? "not-allowed" : "pointer",
                      background: audioLoading || audioPlaying ? "#f1f5f9" : "#ede9fe",
                      color: audioLoading || audioPlaying ? "#94a3b8" : "#6d28d9",
                      border: "1.5px solid #ddd6fe",
                    }}
                  >
                    {audioLoading ? "⏳ Loading…" : audioPlaying ? "🔊 Playing…" : "🔊 Listen to Coach"}
                  </button>
                  {audioPlaying && (
                    <button
                      onClick={stopCoachAudio}
                      style={{ background: "#fee2e2", color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                    >
                      ⏹ Stop
                    </button>
                  )}
                  <button
                    onClick={startRecording}
                    style={{ flex: 1, background: "#dcfce7", color: "#15803d", border: "1.5px solid #86efac", borderRadius: 10, padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                  >
                    🎤 Start Repeating
                  </button>
                </>
              )}

              {phase === "record" && (
                <button
                  onClick={stopRecording}
                  style={{ flex: 1, background: "#fee2e2", color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626", display: "inline-block" }} />
                  Done Repeating
                </button>
              )}

              {phase === "review" && (
                <button
                  onClick={() => nextSegment(segmentResults)}
                  style={{ flex: 1, background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  {currentSegmentIdx + 1 >= (practiceSession?.segments.length ?? 0) ? "🏁 Finish Practice" : "Next Segment →"}
                </button>
              )}
            </div>

            {/* Transcript box */}
            {(phase === "record" || phase === "review") && (
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px" }}>
                <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>Your transcript</p>
                <div style={{ fontSize: 13, color: transcript || recentTranscript ? "#0d1117" : "#cbd5e1", lineHeight: 1.6, maxHeight: 80, overflow: "auto" }}>
                  {transcript || recentTranscript || "(listening…)"}
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Segment card */}
            {seg && (
              <div style={{
                borderRadius: 16, padding: "20px",
                border: `1.5px solid ${fs ? fs.pill : "#e2e8f0"}`,
                background: fs ? fs.bg : "#fff",
                transition: "background 0.4s, border-color 0.4s",
              }}>
                {/* Segment header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span style={{ background: fs?.pill, color: fs?.accent, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                    {FOCUS_ICONS[seg.focus]} {seg.focus}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0d1117" }}>{seg.title}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
                    {currentSegmentIdx + 1} / {practiceSession?.segments.length}
                  </span>
                </div>

                {/* Listen phase: show intro + practice text */}
                {phase === "listen" && (
                  <>
                    <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569", lineHeight: 1.65 }}>{seg.coachIntro}</p>
                    <div style={{ background: "#fff", borderRadius: 10, border: `1.5px solid ${fs?.pill}`, padding: "14px 16px", marginBottom: 12 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>Repeat this aloud:</p>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#0d1117", lineHeight: 1.7 }}>{seg.practiceText}</p>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: fs?.accent, fontWeight: 500 }}>💡 {seg.tip}</p>
                  </>
                )}

                {/* Record phase: keep text visible while recording */}
                {phase === "record" && (
                  <>
                    <div style={{ background: "#fff", borderRadius: 10, border: `1.5px solid ${fs?.pill}`, padding: "14px 16px", marginBottom: 12 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>Repeat this:</p>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#0d1117", lineHeight: 1.7 }}>{seg.practiceText}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fee2e2", borderRadius: 8, padding: "8px 12px" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626", display: "inline-block" }} />
                      <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>Recording in progress…</span>
                    </div>
                  </>
                )}

                {/* Review phase: show segment results */}
                {phase === "review" && lastResult && (
                  <>
                    <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#0d1117" }}>Segment results</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      {[
                        { label: "WPM", value: String(lastResult.wpm), color: "#3b82f6" },
                        { label: "Fillers", value: String(lastResult.fillerCount), color: "#f59e0b" },
                        { label: "Energy", value: lastResult.avgMetrics.energyScore.toFixed(2), color: "#8b5cf6" },
                        { label: "Volume", value: lastResult.avgMetrics.volumeLevel.toFixed(2), color: "#ec4899" },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: "#fff", borderRadius: 10, padding: "10px", textAlign: "center", border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    {lastResult.transcript && (
                      <p style={{ margin: 0, fontSize: 12, color: "#64748b", fontStyle: "italic", lineHeight: 1.5 }}>
                        "{lastResult.transcript.slice(0, 100)}{lastResult.transcript.length > 100 ? "…" : ""}"
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Live metrics panel */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "16px 20px" }}>
              <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>Live Metrics</p>
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
      </div>
    </div>
  );
}
