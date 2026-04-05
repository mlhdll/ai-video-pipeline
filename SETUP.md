# 🛠️ Advanced Setup Guide

Follow these steps to set up your AI Video Production Pipeline from scratch.

## 1. Prerequisites
Ensure you have the following installed on your system:
- **Node.js** (v18.0.0 or higher) - [Download](https://nodejs.org/)
- **Python** (v3.10 or higher) - [Download](https://python.org/)
- **Google Chrome** (For Playwright-based YouTube uploading)
- **Git** (Optional, for version control)

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

# Install Playwright browser
playwright install chromium
```

---

## 3. Configuration (.env)
Copy the template `.env.example` to `.env` and fill in your API keys:
- **KREA_API_KEY**: Your Krea AI key (format: `ID:SECRET`).
- **GEMINI_API_KEY**: Your Google Gemini API key.
- **GROQ_API_KEY**: Your Groq Cloud API key for Whisper.
- **TTS_VOICE**: Chosen narrator voice (e.g., `en-US-ChristopherNeural`).

---

## 4. YouTube Login (One-Time)
Before running the full automation, you need to capture your YouTube session:
1. Run the login script:
   ```bash
   .venv\Scripts\python youtube-login.py
   ```
2. A browser window will open. Log in to your YouTube Studio account.
3. Once logged in, return to the terminal and press **ENTER**.
4. Your session will be saved in `youtube_session/state.json`.

---

## 5. Directory Mapping
| Folder/File | Purpose |
| :--- | :--- |
| `produce-video.js` | Main logic (Planning, TTS, Image generation). |
| `my-video/src/data` | Generated storyboards (JSON). |
| `my-video/public/assets`| AI-generated images and audio files. |
| `generated-plans/` | Raw markdown plans created by Gemini. |
| `out/` | Final rendered video files (.mp4). |

---

## 🚀 Ready to Go!
You can now run the production pipeline using `run-all.bat`.
```bash
run-all.bat "History of Samurai Warriors" 25 shorts
```
