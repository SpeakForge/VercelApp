"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

function countFillers(text: string) {
  const fillers = ["um", "uh", "like", "you know", "so"];
  const lower = (text || "").toLowerCase();
  let count = 0;
  for (const f of fillers) {
    const re = new RegExp(`\\b${f.replace(" ", "\\s+")}\\b`, "g");
    const matches = lower.match(re);
    if (matches) count += matches.length;
  }
  return count;
}

function estimateWpm(words: number, seconds: number) {
  if (!seconds || seconds <= 0) return 0;
  return Math.round((words / seconds) * 60);
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const poseRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Uint8Array | null>(null);
  const volumeHistoryRef = useRef<number[]>([]);
  const audioRafRef = useRef<number | null>(null);

  const [status, setStatus] = useState("Requesting camera/mic...");
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

  const lastHandsRef = useRef<{ t: number; lx: number; ly: number; rx: number; ry: number } | null>(null);

  const SpeechRecognition = useMemo(() => {
    if (typeof window === "undefined") return null;
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  }, []);

  useEffect(() => {
    const startCam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        source.connect(analyser);
        audioDataRef.current = new Uint8Array(analyser.fftSize);

        setStatus("Live");
      } catch {
        setStatus("Permission denied or no camera/mic found.");
      }
    };
    startCam();

    return () => {
      if (audioRafRef.current) cancelAnimationFrame(audioRafRef.current);
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      analyserRef.current = null;
      audioDataRef.current = null;
      volumeHistoryRef.current = [];
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const analyser = analyserRef.current;
      const data = audioDataRef.current;

      if (analyser && data) {
        analyser.getByteTimeDomainData(data);

        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / data.length);
        const level = Math.min(1, rms * 2.5);

        setVolumeLevel(level);
        setEnergyScore((prev) => prev * 0.85 + level * 0.15);

        const hist = volumeHistoryRef.current;
        hist.push(level);
        if (hist.length > 60) hist.shift();

        const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
        const variance = hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length;
        const std = Math.sqrt(variance);

        const varScore = clamp01(std * 6);
        setVariationScore(varScore);
      }

      audioRafRef.current = requestAnimationFrame(tick);
    };

    audioRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (audioRafRef.current) cancelAnimationFrame(audioRafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!SpeechRecognition) {
      setStatus("Use Chrome for live transcript (SpeechRecognition not found).");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: any) => {
      let finalFull = "";
      let interim = "";

      for (let i = 0; i < event.results.length; i++) {
        const chunk = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalFull += chunk + " ";
      }

      const lastIndex = event.results.length - 1;
      if (lastIndex >= 0 && !event.results[lastIndex].isFinal) {
        interim = (event.results[lastIndex][0]?.transcript || "").trim();
      }

      const finalTrimmed = finalFull.trim();
      setTranscript(finalTrimmed);
      setRecentTranscript(interim);

      if (!startedAt) setStartedAt(Date.now());
    };

    rec.onerror = () => {
      setStatus("Mic/transcript error. Check permissions.");
    };

    rec.start();
    return () => rec.stop();
  }, [SpeechRecognition, startedAt]);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000;
      const words = transcript.split(/\s+/).filter(Boolean).length;
      setWpm(estimateWpm(words, seconds));
      setFillerCount(countFillers(transcript));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt, transcript]);

  useEffect(() => {
    const initPose = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      poseRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
        },
        runningMode: "VIDEO",
        numPoses: 1
      });
    };

    initPose();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      poseRef.current?.close();
      poseRef.current = null;
    };
  }, []);

  useEffect(() => {
    const loop = () => {
      const video = videoRef.current;
      const pose = poseRef.current;

      if (video && pose && video.readyState >= 2) {
        const t = performance.now();
        const res = pose.detectForVideo(video, t);

        const lm = res.landmarks?.[0];
        if (lm) {
          const leftWrist = lm[15];
          const rightWrist = lm[16];
          const leftShoulder = lm[11];
          const rightShoulder = lm[12];
          const nose = lm[0];

          const visOk =
            (leftWrist?.visibility ?? 0) > 0.4 &&
            (rightWrist?.visibility ?? 0) > 0.4 &&
            (leftShoulder?.visibility ?? 0) > 0.4 &&
            (rightShoulder?.visibility ?? 0) > 0.4;

          if (visOk) {
            const last = lastHandsRef.current;
            if (last) {
              const dt = (t - last.t) / 1000;
              if (dt > 0) {
                const dL = Math.hypot(leftWrist.x - last.lx, leftWrist.y - last.ly);
                const dR = Math.hypot(rightWrist.x - last.rx, rightWrist.y - last.ry);
                const speed = (dL + dR) / dt;
                const energy = clamp01(speed / 2.2);
                setGestureEnergy(energy);
              }
            }
            lastHandsRef.current = { t, lx: leftWrist.x, ly: leftWrist.y, rx: rightWrist.x, ry: rightWrist.y };

            const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);
            const tiltScore = clamp01(1 - shoulderTilt * 10);

            const headUp = nose.y < (leftShoulder.y + rightShoulder.y) / 2;
            const headScore = headUp ? 1 : 0.4;

            setPostureScore(clamp01(0.65 * tiltScore + 0.35 * headScore));
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div style={{ padding: 40, maxWidth: 980, margin: "0 auto" }}>
      <h1>SpeakForge Live Coach</h1>
      <div style={{ marginBottom: 12, color: "#555" }}>{status}</div>

      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          width: "100%",
          maxWidth: 720,
          borderRadius: 12,
          background: "#111",
          transform: "scaleX(-1)"
        }}
      />

      <div style={{ marginTop: 20, display: "grid", gap: 10, maxWidth: 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>WPM</span>
          <b>{wpm}</b>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Filler count</span>
          <b>{fillerCount}</b>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Gesture energy</span>
          <b>{gestureEnergy.toFixed(2)}</b>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Posture score</span>
          <b>{postureScore.toFixed(2)}</b>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Volume</span>
          <b>{volumeLevel.toFixed(2)}</b>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Energy</span>
          <b>{energyScore.toFixed(2)}</b>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Variation</span>
          <b>{variationScore.toFixed(2)}</b>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Recent transcript</div>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10, minHeight: 48 }}>
            {recentTranscript || "(waiting...)"} 
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Full transcript</div>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 10,
              maxHeight: 180,
              overflow: "auto",
              whiteSpace: "pre-wrap"
            }}
          >
            {transcript || "(waiting...)"} 
          </div>
        </div>
      </div>
    </div>
  );
}