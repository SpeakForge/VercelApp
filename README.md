SpeakForge is a real-time public speaking feedback tool that was built with Next.js, MediaPipe, and the Web Audio API. The live feedback is based on posture, gestures, pacing, vocal energy, and filler words, which can all be viewed as the user speaks.

Overview

When a user opens the application and enables their camera and microphone, the system does the following:
-Tracks body posture and gesture movement using MediaPipe Pose.
-Analyzes vocal energy and variation using the Web Audio API.
-Transcribes speech in real time using the browser's Speech Recognition API.
-Calculates WPM and filler word frequency.
-Sends live metrics and transcript data to a Gemini API endpoint.
-Receives AI feedback focused on the single biggest issue.
-Displays live metrics and an overlay for feedback.

Features

Video analysis
Uses MediaPipe Pose to detect:
-Shoulder alignment
-Head position
-Wrist movement
-Gesture intensity

Voice analysis
Uses the Web Audio API to compute:
-Volume level
-Smoothed vocal energy
-Vocal variation (standard deviation over time)

Speech analysis
Uses the Web Speech API to:
-Transcribe speech
-Calculate WPM
-Count filler words: "um", "uh", "like", and "you know"

Feedback is based on metrics and their thresholds. For example:

High WPM: "Slow down your pace"
Low energy: "Add more vocal energy"
High filler count: "Reduce filler words."
Poor posture: "Straighten your posture"

Manual feedback trigger
A "Get feedback now" button evaluates current performance instead of running on an automatic interval to conserve tokens.

AI feedback:

Uses Gemini API to:
Analyze metrics and transcript content
Identify the single biggest speaking weakness in that moment (when the button is pressed)
Return JSON feedback
Generate coaching tips (under 6 words)

Tech Stack:

Next.js (App Router): Frontend and API routes
React (Client Components): Real-time UI updates
MediaPipe Tasks Vision: Pose and gesture detection
Web Audio API: Vocal energy and variation analysis
Web Speech API: Live speech transcription
Gemini API (generateContent): AI-powered coaching feedback
TypeScript: Type safety and structured development
