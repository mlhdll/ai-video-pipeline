# 🎥 AI Video Production Pipeline

**Fully automated documentary & social video engine.** 
This project allows you to generate cinematic history (or any documentary) videos with dynamic subtitles, AI-generated voices, high-quality images, and automated YouTube uploading using just a single prompt.

> [!NOTE]
> This repository is a generalized version for public use. Replace **[YOUR_CHANNEL_NAME]** , **[YOUR_BRAND_NAME]**, **TAGS** and **prompts in produce-video.js** placeholders with your own settings.

---

## ✨ Features
- **Auto-Storyboard**: Generates multi-scene video plans via Google Gemini.
- **Narrator Voices**: Natural TTS via Microsoft Edge (Free).
- **Cinematic Images**: High-quality Z-Image generation via Krea AI API. (Resolution customizable!)
- **Dynamic Subtitles**: Word-level synchronized subtitles via Groq Whisper.
- **Remotion Render**: Programmatic video editing and rendering.
- **Official YouTube API**: Secure, automated upload and scheduling.

## 📚 Documentation
Detailed guides are located in the [docs/](./docs) folder:
- **[Quick Start Guide](./docs/QUICK-START.md)**: Speedrun your first video.
- **[Full Setup Guide](./docs/SETUP.md)**: Prerequisites, dependencies, and API configuration.
- **[Video Production Guide](./docs/VIDEO-PRODUCTION-GUIDE.md)**: Deep dive into planning, styles, and customization.

---

## 🚀 Quick Start

### 1. Requirements
- **Node.js** (v18+)
- **Python** (v3.10+)
- **API Keys**:
  - [Krea AI](https://krea.ai) (Z-Image generation)
  - [Google Gemini](https://aistudio.google.com/) (Plan & Metadata generation)
  - [Groq Cloud](https://console.groq.com/) (Whisper for subtitles)

### 2. Setup

#### Step 1: Get the Code
**Option A: Clone the repository (For Developers)**
```bash
git clone https://github.com/mlhdll/ai-video-pipeline.git
cd ai-video-pipeline
```

**Option B: Download as ZIP (For Non-Git Users)**
1. Go to the [GitHub Repository Page](https://github.com/mlhdll/ai-video-pipeline).
2. Click the green **Code** button and select **Download ZIP**.
3. Extract the ZIP and open your terminal in that folder.

---

#### Step 2: Install Dependencies
1. **Install Node.js packages**:
   ```bash
   npm install
   cd my-video && npm install && cd ..
   ```
2. **Setup Python Virtual Environment**:
   ```bash
   python -m venv .venv
   .\.venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   ```

#### Step 3: Configure Environment
1. Create your environment file:
   ```bash
   cp .env.example .env
   # Fill in your API keys in .env
   ```
2. **YouTube API Setup**:
   - Save your `client_secrets.json` to the root folder.
   - Run once to authorize and create `token.json`:
     ```bash
     .\.venv\Scripts\python youtube_api_upload.py
     ```

### 3. Usage

Run the batch script with your topic and desired scene count:
```bash
# Only Main Video
run-all.bat "Ancient Greece Mythology" 20

# Main Video + Shorts (Sequential Upload)
run-all.bat "Ancient Greece Mythology" 20 shorts
```
This script will:
1. Generate the script, voices, and images.
2. Render the final MP4(s).
3. Upload and **schedule** them for 02:00 AM automatically.

- `"Ancient Greece Mythology"`: Your video topic.
- `20`: Number of scenes.
- `shorts`: (Optional) Add this to generate and upload **BOTH** the main video and the Shorts version.

---

## 🛠️ Customization Guide

### Branding & Narrative
To make the channel truly yours, update the following:
1. **Logo/Branding**: Edit `my-video/src/components/ShortsComposition.tsx` to change the on-screen channel name.
2. **Narration Style**: Update the prompts in `produce-video.js` (look for `metaPrompt` and `sysPrompt`) to change how Gemini writes your scripts.
3. **Voiceover**: Change `TTS_VOICE` in `.env` to a voice that fits your niche.
4. **Channel Branding & Script Style**
To make the content truly yours, update the following in `produce-video.js`:
- **Style Keywords**: Look for `thumbPrompt` and `qualityTags`. By default, they use "dramatic, intense, cinematic" keywords. Change these to your niche (e.g., "minimalist, colorful, cartoonish") to change the overall feel of your channel.
- **Tags**: Edit the `TAGS` section in the prompt generation logic to match your SEO strategy.
5. **Image Resolution & Aspect Ratio**
You can change the generation resolution in `produce-video.js` inside the `generateImage` function:
- Find the `width` and `height` parameters.
- Default is **1280x720** for horizontal and **720x1280** for Shorts.
- Higher resolutions might require more API credits or time.

---

## 📁 Repository Structure
- `produce-video.js`: Core engine (Planning, TTS, Image generation).
- `youtube_api_upload.py`: Official YouTube Data API uploader & scheduler.
- `run-all.bat`: Main Windows batch script for automated execution.
- `my-video/`: Remotion project for visual composition.

---

## 🛡️ License
MIT License - Feel free to use and adapt this for your own AI channels!
