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

  const [status, setStatus] = useState("Requesting camera/mic...");
  const [transcript, setTranscript] = useState("");
  const [recentTranscript, setRecentTranscript] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [fillerCount, setFillerCount] = useState(0);

  const [gestureEnergy, setGestureEnergy] = useState(0);
  const [postureScore, setPostureScore] = useState(0);

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
        setStatus("Live");
      } catch {
        setStatus("Permission denied or no camera/mic found.");
      }
    };
    startCam();
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
      setWpm(estimateWpm(wordCount, seconds));
      setFillerCount(countFillers(transcript));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt, wordCount, transcript]);

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