# ⚡ Quick Start Guide

Ready to create your first AI-generated video? Follow these 5 quick steps:

## 1. Installation
Install all Node.js and Python dependencies as described in the [Setup Guide](./SETUP.md).

---

## 2. API Configuration
1. Open `.env` and enter your API keys:
   - `KREA_API_KEY`: ID:SECRET from Krea.ai
   - `GEMINI_API_KEY`: from Google AI Studio
   - `GROQ_API_KEY`: from Groq Console
2. Set your chosen voice (e.g., `en-US-ChristopherNeural`).

---

## 3. YouTube Session
Run the login script once to authorize your channel:
```bash
.venv\Scripts\python youtube-login.py
```

---

## 4. Run the Pipeline!
Run the batch script with your desired topic and scene count:
```bash
# General long-form video (16:9)
run-all.bat "Rising from the Ashes" 25

# Video + Shorts (9:16)
run-all.bat "Rising from the Ashes" 25 shorts
```

---

## 5. What Happens Now?
1. **Gemini** writes a detailed script & prompts.
2. **Krea AI** generates cinematic images for each scene.
3. **Microsoft Edge** generates high-quality narrator audio.
4. **Groq Whisper** extracts word timings for perfect subtitles.
5. **Remotion** renders the final .mp4 video.
6. **Playwright** uploads everything to YouTube automatically.

---

## 💡 Pro Tip
Check `generated-plans/` to see the raw markdown scripts created by the AI. You can edit them manually and re-run the pipeline to refine your videos!
