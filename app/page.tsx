"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [status, setStatus] = useState("Requesting camera/mic...");
  const [transcript, setTranscript] = useState("");
  const [recentTranscript, setRecentTranscript] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [fillerCount, setFillerCount] = useState(0);

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
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += chunk + " ";
        else interimText += chunk + " ";
      }

      const combinedChunk = (finalText + interimText).trim();
      if (combinedChunk) setRecentTranscript(combinedChunk);

      setTranscript((prev) => (prev + " " + finalText).trim());

      if (!startedAt) setStartedAt(Date.now());

      const words = combinedChunk.split(/\s+/).filter(Boolean).length;
      if (words) setWordCount((prev) => prev + words);
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