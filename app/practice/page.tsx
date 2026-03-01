"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import Navbar from "../components/Navbar";
import Card from "../components/Card";

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

const FOCUS_LABELS: Record<FocusType, string> = {
  pace: "Pace", fillers: "Fillers", energy: "Energy", variation: "Variation",
  gestures: "Gestures", posture: "Posture", content: "Content",
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
    <div style={{ height: 6, background: "var(--border-light)", borderRadius: 99, overflow: "hidden", marginTop: 4 }}>
      <div style={{ height: "100%", width: `${Math.round(value * 100)}%`, background: color, borderRadius: 99, transition: "width 1.2s ease" }} />
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
  const gestureSmoothedRef = useRef(0);
  const postureSmoothedRef = useRef(0);
  const variationFrameRef = useRef(0);

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
  const [practiceMode, setPracticeMode] = useState<"ai" | "custom">("ai");
  const [customText, setCustomText] = useState("");
  const [customDone, setCustomDone] = useState(false);

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
  const userEmailRef = useRef<string>("anonymous");

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
    // Key is scoped per user so switching accounts never shows another user's session
    const CACHE_KEY = `speakforge_practice_session_${userEmailRef.current}`;
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
    Promise.all([
      fetch("/api/practice/generate").then(r => r.ok ? r.json() : Promise.reject("Failed to generate")),
      new Promise(r => setTimeout(r, 1500)),
    ])
      .then(([data]) => {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ session: data, generatedAt: Date.now() })); } catch { /* storage full */ }
        setPracticeSession(data as typeof data);
        setPhase("listen");
      })
      .catch(() => setGenError("Couldn't generate your practice session. Please try again."));
  };

  useEffect(() => {
    // Fetch user first so the cache key is scoped correctly before loading the session
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.name) setUser(d);
        if (d?.email) userEmailRef.current = d.email;
        loadPracticeSession();
      });
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

  // Re-attach camera stream whenever the video element re-mounts (after loading/complete screens)
  useEffect(() => {
    if (phase === "loading" || phase === "complete") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
  }, [phase]);

  // Audio analysis loop
  useEffect(() => {
    const tick = () => {
      const analyser = analyserRef.current, data = audioDataRef.current;
      if (analyser && data) {
        analyser.getByteTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sumSq += v * v; }
        const rawLevel = clamp01(Math.sqrt(sumSq / data.length) * 14);
        // Heavy smoothing — values drift slowly so the display is readable
        const speaking = rawLevel > 0.04;
        sustainedVolumeRef.current = speaking
          ? clamp01(sustainedVolumeRef.current * 0.92 + rawLevel * 0.08)
          : clamp01(sustainedVolumeRef.current * 0.97);
        sustainedEnergyRef.current = speaking
          ? clamp01(sustainedEnergyRef.current * 0.90 + rawLevel * 0.10)
          : clamp01(sustainedEnergyRef.current * 0.97);
        setVolumeLevel(sustainedVolumeRef.current);
        setEnergyScore(sustainedEnergyRef.current);
        const hist = volumeHistoryRef.current;
        hist.push(rawLevel);
        if (hist.length > 180) hist.shift();
        // Variation: update every 30 frames (~500 ms) over a wider window
        variationFrameRef.current++;
        if (variationFrameRef.current % 30 === 0 && hist.length >= 20) {
          const recent = hist.slice(-120);
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
      if (video && pose && video.readyState >= 2 && now - lastPoseTimeRef.current >= 200) {
        lastPoseTimeRef.current = now;
        const t = now, res = pose.detectForVideo(video, t), lm = res.landmarks?.[0];
        if (lm) {
          const lw = lm[15], rw = lm[16], ls = lm[11], rs = lm[12], nose = lm[0];
          const vis = [lw, rw, ls, rs].every(p => (p?.visibility ?? 0) > 0.4);
          if (vis) {
            const last = lastHandsRef.current;
            if (last) {
              const dt = (t - last.t) / 1000;
              if (dt > 0) {
                const raw = clamp01((Math.hypot(lw.x - last.lx, lw.y - last.ly) + Math.hypot(rw.x - last.rx, rw.y - last.ry)) / dt / 2.2);
                gestureSmoothedRef.current = clamp01(gestureSmoothedRef.current * 0.80 + raw * 0.20);
                setGestureEnergy(gestureSmoothedRef.current);
              }
            }
            lastHandsRef.current = { t, lx: lw.x, ly: lw.y, rx: rw.x, ry: rw.y };
            const rawPosture = clamp01(0.65 * clamp01(1 - Math.abs(ls.y - rs.y) * 10) + 0.35 * (nose.y < (ls.y + rs.y) / 2 ? 1 : 0.4));
            postureSmoothedRef.current = clamp01(postureSmoothedRef.current * 0.85 + rawPosture * 0.15);
            setPostureScore(postureSmoothedRef.current);
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

  const startCustomRecording = () => {
    if (!recRef.current || isRecordingRef.current) return;
    metricsHistoryRef.current = [];
    sessionStartRef.current = Date.now();
    setTranscript(""); setRecentTranscript(""); setStartedAt(Date.now());
    setWpm(0); setFillerCount(0);
    setCustomDone(false);
    setIsRecording(true);
    recRef.current.start();
  };

  const stopCustomRecording = () => {
    if (!recRef.current || !isRecordingRef.current) return;
    setIsRecording(false);
    isRecordingRef.current = false;
    recRef.current.stop();
    setCustomDone(true);
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const seg = practiceSession?.segments?.[currentSegmentIdx];
  const fs = seg ? FOCUS_STYLES[seg.focus] : null;
  const lastResult = segmentResults[segmentResults.length - 1];

  // ── Loading screen ────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {genError ? (
          <div style={{ textAlign: "center", maxWidth: 400 }}>
            <p style={{ color: "#dc2626", marginBottom: 20, fontSize: 15 }}>{genError}</p>
            <button onClick={() => router.push("/")} className="btn-ghost" style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--radius-pill)", padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← Back to Home</button>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div className="spinner" style={{ margin: "0 auto 28px" }}><div /><div /><div /><div /><div /><div /></div>
            <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>Analyzing your history…</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Building a personalized practice session just for you</p>
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

    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <Navbar />

        {/* Sub-header */}
        <div style={{ borderBottom: "1px solid var(--border-light)", padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(247,250,252,0.8)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", position: "relative", zIndex: 1 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-0.6px", color: "var(--text)" }}>Practice <span style={{ color: "var(--gold)" }}>Complete</span></h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{practiceSession?.sessionTitle}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setSegmentResults([]); setCurrentSegmentIdx(0); loadPracticeSession(true); }} className="btn-ghost" style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--radius-pill)", padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>New Session</button>
            <button onClick={() => router.push("/coach")} className="btn-primary" style={{ background: "var(--dark)", color: "#fff", border: "none", borderRadius: "var(--radius-pill)", padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Coach Mode</button>
          </div>
        </div>

        <div style={{ padding: "32px 40px 60px", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Banner */}
            <Card style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Session <span style={{ color: "var(--gold)" }}>Complete</span></h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>{practiceSession?.sessionTitle}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, maxWidth: 520, margin: "0 auto" }}>
                {[
                  { label: "Segments", value: String(segmentResults.length), color: "var(--text)" },
                  { label: "Avg WPM", value: String(overallWpm), color: "#3b82f6" },
                  { label: "Fillers", value: String(overallFillers), color: "#f59e0b" },
                  { label: "Energy", value: overallEnergy.toFixed(2), color: "#8b5cf6" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)", padding: "14px 10px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                    <div style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Per-segment results */}
            <div>
              <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>Segment Breakdown</p>
              {segmentResults.map((r, i) => {
                const s = practiceSession?.segments?.[r.segmentIdx];
                const sfs = s ? FOCUS_STYLES[s.focus] : null;
                return (
                  <Card key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ background: sfs?.pill, color: sfs?.accent, borderRadius: "var(--radius-pill)", padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                        {s ? FOCUS_LABELS[s.focus] : ""}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{s?.title}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                      {[
                        { label: "WPM", value: String(r.wpm), color: "#3b82f6" },
                        { label: "Fillers", value: String(r.fillerCount), color: "#f59e0b" },
                        { label: "Energy", value: r.avgMetrics.energyScore.toFixed(2), color: "#8b5cf6" },
                        { label: "Volume", value: r.avgMetrics.volumeLevel.toFixed(2), color: "#ec4899" },
                        { label: "Posture", value: r.avgMetrics.postureScore.toFixed(2), color: "#6366f1" },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: "var(--bg)", borderRadius: "var(--radius-xs)", padding: "8px 6px", textAlign: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
                          <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    {r.transcript && (
                      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-subtle)", fontStyle: "italic" }}>"{r.transcript.slice(0, 120)}{r.transcript.length > 120 ? "…" : ""}"</p>
                    )}
                  </Card>
                );
              })}
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── Main practice UI ──────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <audio ref={coachAudioRef} style={{ display: "none" }} />
      <Navbar />

      {/* Sub-header */}
      <div style={{ borderBottom: "1px solid var(--border-light)", padding: "16px 40px", display: "flex", alignItems: "center", gap: 14, background: "rgba(247,250,252,0.8)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", position: "relative", zIndex: 1 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-0.6px", color: "var(--text)" }}>Practice <span style={{ color: "var(--gold)" }}>Mode</span></h1>

        {/* Mode switcher */}
        <div style={{ display: "flex", gap: 2, background: "var(--border-light)", borderRadius: "var(--radius-pill)", padding: 3, marginLeft: 8 }}>
          {(["ai", "custom"] as const).map(m => (
            <button key={m} onClick={() => setPracticeMode(m)} style={{
              background: practiceMode === m ? "var(--dark)" : "transparent",
              color: practiceMode === m ? "#fff" : "var(--text-muted)",
              border: "none", borderRadius: "var(--radius-pill)",
              padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "background 0.2s, color 0.2s",
            }}>
              {m === "ai" ? "AI Practice" : "Your Speech"}
            </button>
          ))}
        </div>

        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: camStatus === "live" ? "#22c55e" : "var(--text-muted)" }}>
          <span className={camStatus === "live" ? "live-dot" : undefined} style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
          {camStatus === "live" ? "Live" : "Starting…"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {practiceMode === "ai" && (
            <button onClick={() => { setSegmentResults([]); setCurrentSegmentIdx(0); loadPracticeSession(true); }} className="btn-ghost" style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--radius-pill)", padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Regenerate</button>
          )}
        </div>
      </div>

      <div style={{ padding: "20px 40px 48px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Roadmap stepper — AI mode only */}
          {practiceMode === "ai" && practiceSession && (
            <Card style={{ marginBottom: 16, padding: "16px 24px" }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>
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
                          background: done ? "var(--gold)" : active ? sfs.pill : "var(--bg)",
                          color: done ? "var(--dark)" : active ? sfs.accent : "var(--text-muted)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700,
                          border: active ? `2px solid ${sfs.accent}` : done ? "2px solid var(--gold)" : "2px solid var(--border)",
                          transition: "all 0.3s",
                        }}>
                          {done ? "✓" : String(i + 1)}
                        </div>
                        <span style={{ fontSize: 10, color: active ? sfs.accent : done ? "var(--gold)" : "var(--text-muted)", marginTop: 5, fontWeight: active || done ? 700 : 400, textAlign: "center", maxWidth: 70 }}>
                          {s.title}
                        </span>
                      </div>
                      {i < practiceSession.segments.length - 1 && (
                        <div style={{ height: 2, flex: 0.4, background: done ? "var(--gold)" : "var(--border-light)", marginBottom: 20, transition: "background 0.3s" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Main grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, alignItems: "start" }}>

            {/* Left: Video + controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-md)", background: "#0f172a", lineHeight: 0 }}>
                <video ref={videoRef} playsInline muted
                  style={{ width: "100%", display: "block", transform: "scaleX(-1)", aspectRatio: "16/9", objectFit: "cover" }}
                />
              </div>

              {/* Phase / mode action buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                {practiceMode === "custom" ? (
                  <>
                    <button
                      onClick={() => customText.trim() && playCoachAudio(customText)}
                      disabled={!customText.trim() || audioLoading || audioPlaying}
                      style={{
                        flex: 1, borderRadius: "var(--radius-pill)", padding: "10px 0", fontSize: 14, fontWeight: 700,
                        cursor: (!customText.trim() || audioLoading || audioPlaying) ? "not-allowed" : "pointer",
                        background: (!customText.trim() || audioLoading || audioPlaying) ? "var(--bg)" : "var(--gold-light)",
                        color: (!customText.trim() || audioLoading || audioPlaying) ? "var(--text-muted)" : "var(--gold)",
                        border: "1.5px solid var(--gold-border)",
                      }}
                    >
                      {audioLoading ? "Loading…" : audioPlaying ? "Playing…" : "Listen to Coach"}
                    </button>
                    {audioPlaying && (
                      <button onClick={stopCoachAudio} style={{ background: "#fee2e2", color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: "var(--radius-pill)", padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                        Stop
                      </button>
                    )}
                    {!isRecording ? (
                      <button
                        onClick={startCustomRecording}
                        disabled={!customText.trim()}
                        style={{ flex: 1, background: !customText.trim() ? "var(--bg)" : "var(--dark)", color: !customText.trim() ? "var(--text-muted)" : "#fff", border: "none", borderRadius: "var(--radius-pill)", padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: !customText.trim() ? "not-allowed" : "pointer" }}
                      >
                        Start Recording
                      </button>
                    ) : (
                      <button
                        onClick={stopCustomRecording}
                        style={{ flex: 1, background: "#fee2e2", color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: "var(--radius-pill)", padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626", display: "inline-block" }} />
                        Stop Recording
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {phase === "listen" && (
                      <>
                        <button
                          onClick={() => seg && playCoachAudio(seg.coachIntro + " " + seg.practiceText)}
                          disabled={audioLoading || audioPlaying}
                          style={{
                            flex: 1, borderRadius: "var(--radius-pill)", padding: "10px 0", fontSize: 14, fontWeight: 700,
                            cursor: audioLoading || audioPlaying ? "not-allowed" : "pointer",
                            background: audioLoading || audioPlaying ? "var(--bg)" : "var(--gold-light)",
                            color: audioLoading || audioPlaying ? "var(--text-muted)" : "var(--gold)",
                            border: "1.5px solid var(--gold-border)",
                          }}
                        >
                          {audioLoading ? "Loading…" : audioPlaying ? "Playing…" : "Listen to Coach"}
                        </button>
                        {audioPlaying && (
                          <button onClick={stopCoachAudio} style={{ background: "#fee2e2", color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: "var(--radius-pill)", padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                            Stop
                          </button>
                        )}
                        <button onClick={startRecording} style={{ flex: 1, background: "var(--dark)", color: "#fff", border: "none", borderRadius: "var(--radius-pill)", padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                          Start Repeating
                        </button>
                      </>
                    )}
                    {phase === "record" && (
                      <button onClick={stopRecording} style={{ flex: 1, background: "#fee2e2", color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: "var(--radius-pill)", padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626", display: "inline-block" }} />
                        Done Repeating
                      </button>
                    )}
                    {phase === "review" && (
                      <button onClick={() => nextSegment(segmentResults)} style={{ flex: 1, background: "var(--dark)", color: "#fff", border: "none", borderRadius: "var(--radius-pill)", padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                        {currentSegmentIdx + 1 >= (practiceSession?.segments.length ?? 0) ? "Finish Practice" : "Next Segment →"}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Transcript box */}
              {(practiceMode === "custom" ? (isRecording || customDone) : (phase === "record" || phase === "review")) && (
                <Card style={{ padding: "14px 16px" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>Your transcript</p>
                  <div style={{ fontSize: 13, color: transcript || recentTranscript ? "var(--text)" : "var(--text-subtle)", lineHeight: 1.6, maxHeight: 80, overflow: "auto" }}>
                    {transcript || recentTranscript || "(listening…)"}
                  </div>
                </Card>
              )}
            </div>

            {/* Right panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Your Speech input card */}
              {practiceMode === "custom" && (
                <div style={{ borderRadius: "var(--radius-lg)", padding: "20px", border: "1.5px solid var(--gold-border)", background: "var(--gold-light)", boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ background: "var(--gold)", color: "#fff", borderRadius: "var(--radius-pill)", padding: "2px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Your Speech
                    </span>
                  </div>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                    Paste or type any text you want to practice. The AI reads it back first, then you record yourself saying it.
                  </p>
                  <textarea
                    value={customText}
                    onChange={e => setCustomText(e.target.value)}
                    placeholder="Paste your speech, a paragraph from your presentation, or anything you want to practice aloud…"
                    style={{
                      width: "100%", minHeight: 148, padding: "12px 14px",
                      fontSize: 13, color: "var(--text)", background: "#fff",
                      border: "1.5px solid var(--gold-border)", borderRadius: "var(--radius-sm)",
                      resize: "vertical", fontFamily: "inherit", lineHeight: 1.65,
                      boxSizing: "border-box", outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--gold)", fontWeight: 500 }}>
                      💡 Tip: listen first, then record yourself repeating it
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--text-subtle)" }}>{customText.length} chars</p>
                  </div>
                </div>
              )}

              {/* Segment card — AI mode only */}
              {practiceMode === "ai" && seg && (
                <div style={{
                  borderRadius: "var(--radius-lg)", padding: "20px",
                  border: `1.5px solid ${fs ? fs.pill : "var(--border-light)"}`,
                  background: fs ? fs.bg : "var(--surface)",
                  boxShadow: "var(--shadow-sm)",
                  transition: "background 0.4s, border-color 0.4s",
                }}>
                  {/* Segment header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={{ background: fs?.pill, color: fs?.accent, borderRadius: "var(--radius-pill)", padding: "2px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                      {FOCUS_LABELS[seg.focus]}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{seg.title}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-subtle)", fontWeight: 600 }}>
                      {currentSegmentIdx + 1} / {practiceSession?.segments.length}
                    </span>
                  </div>

                  {/* Listen phase: show intro + practice text */}
                  {phase === "listen" && (
                    <>
                      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.65 }}>{seg.coachIntro}</p>
                      <div style={{ background: "var(--surface-solid)", borderRadius: "var(--radius-sm)", border: `1.5px solid ${fs?.pill}`, padding: "14px 16px", marginBottom: 12 }}>
                        <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>Repeat this aloud:</p>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)", lineHeight: 1.7 }}>{seg.practiceText}</p>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: fs?.accent, fontWeight: 500 }}>{seg.tip}</p>
                    </>
                  )}

                  {/* Record phase: keep text visible while recording */}
                  {phase === "record" && (
                    <>
                      <div style={{ background: "var(--surface-solid)", borderRadius: "var(--radius-sm)", border: `1.5px solid ${fs?.pill}`, padding: "14px 16px", marginBottom: 12 }}>
                        <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>Repeat this:</p>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)", lineHeight: 1.7 }}>{seg.practiceText}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fee2e2", borderRadius: "var(--radius-xs)", padding: "8px 12px" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626", display: "inline-block" }} />
                        <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>Recording in progress…</span>
                      </div>
                    </>
                  )}

                  {/* Review phase: show segment results */}
                  {phase === "review" && lastResult && (
                    <>
                      <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Segment results</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                        {[
                          { label: "WPM", value: String(lastResult.wpm), color: "#3b82f6" },
                          { label: "Fillers", value: String(lastResult.fillerCount), color: "#f59e0b" },
                          { label: "Energy", value: lastResult.avgMetrics.energyScore.toFixed(2), color: "#8b5cf6" },
                          { label: "Volume", value: lastResult.avgMetrics.volumeLevel.toFixed(2), color: "#ec4899" },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)", padding: "10px", textAlign: "center", border: "1px solid var(--border-light)" }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                            <div style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 2 }}>{label}</div>
                          </div>
                        ))}
                      </div>
                      {lastResult.transcript && (
                        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", lineHeight: 1.5 }}>
                          "{lastResult.transcript.slice(0, 100)}{lastResult.transcript.length > 100 ? "…" : ""}"
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Live metrics panel */}
              <Card>
                <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>Live Metrics</p>
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
                        <span style={{ color: "var(--text-muted)" }}>{label}</span>
                        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{display}</span>
                      </div>
                      <ScoreBar value={bar} color={color} />
                    </div>
                  ))}
                </div>
              </Card>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
