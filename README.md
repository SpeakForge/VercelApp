# SpeakForge

SpeakForge is a real-time AI public speaking coach built with Next.js, MediaPipe, and the Web Audio API. It tracks posture, gestures, vocal energy, pacing, and filler words while you speak — and gives live AI feedback every 5 seconds powered by Gemini.

---

## Overview

When a user opens the application and enables their camera and microphone, the system:

- Tracks body posture and gesture movement using MediaPipe Pose
- Analyzes vocal energy and variation using the Web Audio API
- Transcribes speech in real time using the browser's Speech Recognition API
- Calculates WPM and filler word frequency
- Automatically sends live metrics and transcript to Gemini every 5 seconds
- Receives AI coaching feedback — corrective tips when something needs work, or encouraging compliments when performance is strong
- Displays a session summary with an AI-generated score, strengths, and areas to improve after the session ends

---

## Features

### Video Analysis
Uses MediaPipe Pose to detect:
- Shoulder alignment
- Head position relative to shoulders
- Wrist movement speed
- Gesture intensity and smoothed energy

### Voice Analysis
Uses the Web Audio API to compute:
- Volume level (sustained RMS)
- Smoothed vocal energy
- Vocal variation over a rolling window

### Speech Analysis
Uses the Web Speech API to:
- Transcribe speech in real time (final + interim results)
- Calculate words per minute (WPM)
- Count filler words: "um", "uh", "like", "so", "you know"

### Planned Speech
Paste a script before presenting. Gemini uses it to detect missing topics and content gaps in the live transcript.

### Live AI Feedback (Auto every 5s)
Gemini receives metrics (excluding WPM, which is reserved for the summary) and the live transcript, then returns:
- A short coaching tip (≤ 6 words) focused on the single biggest issue, **or** an encouraging compliment if the speaker is performing well overall
- A focus category: `pace`, `fillers`, `energy`, `variation`, `gestures`, `posture`, `content`, or `positive`
- A brief reason (≤ 5 words)

Feedback is skipped if a prior request is still in flight.

### Session Summary
After stopping the recording, a full summary is generated including:
- AI overview and score (0–100)
- Strengths and areas to improve
- Duration, word count, average WPM, filler count
- Average metrics across the session (gesture energy, posture, energy, variation, volume)
- Full transcript

Sessions can be **saved** to the database or **discarded** — saving is always manual.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend & API routes | Next.js (App Router) |
| UI | React client components |
| Pose & gesture detection | MediaPipe Tasks Vision |
| Vocal analysis | Web Audio API |
| Speech transcription | Web Speech API |
| AI coaching | Gemini 2.5 Flash (`generateContent`) |
| Auth & sessions | Custom API routes + database |
| Language | TypeScript |
