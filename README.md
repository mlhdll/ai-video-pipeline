# 🎥 AI Video Production Pipeline

**Fully automated documentary & social video engine.** 
This project allows you to generate cinematic history (or any documentary) videos with dynamic subtitles, AI-generated voices, high-quality images, and automated YouTube uploading using just a single prompt.

> [!NOTE]
> This repository is a generalized version for public use. Replace **[YOUR_CHANNEL_NAME]** and **[BRANDING]** placeholders with your own settings.

---

## ✨ Features
- **Auto-Storyboard**: Generates multi-scene video plans via Google Gemini.
- **Narrator Voices**: Natural TTS via Microsoft Edge (Free).
- **Cinematic Images**: High-quality Z-Image generation via Krea AI API. (Resolution customizable!)
- **Dynamic Subtitles**: Word-level synchronized subtitles via Groq Whisper.
- **Remotion Render**: Programmatic video editing and rendering.
- **Auto-Upload**: Fully automated YouTube Studio uploading (including metadata and thumbnails).

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

#### Option A: Clone the repository (For Developers)
```bash
git clone https://github.com/mlhdll/ai-video-pipeline.git
cd ai-video-pipeline
```

#### Option B: Download as ZIP (For Non-Git Users)
1. Go to the [GitHub Repository Page](https://github.com/mlhdll/ai-video-pipeline).
2. Click the green **Code** button and select **Download ZIP**.
3. Extract the downloaded folder to your computer.
4. Open your terminal (CMD or PowerShell) in that extracted folder.

---

#### 3. Install Dependencies
1. Install Node.js dependencies:
   ```bash
   npm install
   cd my-video && npm install && cd ..
   ```
2. Create your environment file:
   ```bash
   cp .env.example .env
   # Fill in your API keys in .env
   ```
3. Set up the Python virtual environment:
   Refer to the [Setup Guide](./SETUP.md) for detailed Python and Playwright installation steps.

### 3. Usage
Run the entire pipeline (Produce -> Render -> Upload) with one command:
```bash
run-all.bat "The Secrets of Ancient Rome" 20
```
- `"The Secrets of Ancient Rome"`: Your video topic.
- `20`: Number of scenes (more = longer video).
- `shorts`: (Optional) Add this to generate 9:16 Shorts along with the main video.

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
- `produce-video.js`: Core engine (Planning, TTS, Image generation, Resolution settings).
- `my-video/`: Remotion project for visual rendering.
- `youtube-upload.py`: Playwright-based automated YouTube uploader.
- `youtube-login.py`: One-time session capture tool for YouTube.

---

## 🛡️ License
MIT License - Feel free to use and adapt this for your own AI channels!
