# 🛠️ Advanced Setup Guide

Follow these steps to set up your AI Video Production Pipeline from scratch.

## 1. Prerequisites
- **Node.js** (v18.0.0 or higher)
- **Python** (v3.10 or higher)
- **Google Cloud Project** with **YouTube Data API v3** enabled.

---

## 2. Environment Setup

### Node.js Dependencies
Install the required packages for the main logic and the Remotion project:
```bash
# In the root directory
npm install

# In the Remotion project directory
cd my-video
npm install
cd ..
```

### Python Virtual Environment
Required for the automated YouTube uploader:
```bash
# Create a virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Install requirements
pip install -r requirements.txt
```

---

## 3. Configuration (.env)
Copy the template `.env.example` to `.env` and fill in your API keys:
- **KREA_API_KEY**: Your Krea AI key (format: `ID:SECRET`).
- **GEMINI_API_KEY**: Your Google Gemini API key.
- **GROQ_API_KEY**: Your Groq Cloud API key for Whisper.
- **TTS_VOICE**: Chosen narrator voice (e.g., `en-US-ChristopherNeural`).

---

## 4. YouTube API Setup (One-Time)
1. Place your `client_secrets.json` in the root folder.
2. Run the authentication script:
   ```bash
   .\.venv\Scripts\python youtube_api_upload.py
   ```
3. Authorize in the browser to generate `token.json`. **Keep both secret and token files secure.**

---

## 🚀 Ready to Go!
You can now run the production pipeline using `run-all.bat`.
```bash
run-all.bat "The Secrets of Mars" 15
```
