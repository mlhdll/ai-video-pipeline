# 🎬 Video Production Methodology

This guide explains how the AI Video Engine works and how to customize your channel's unique look.

---

## 🏗️ Architecture Layers
The pipeline consists of four distinct AI-driven layers:

### 1. Planning Layer (Google Gemini)
Gemini generates a structured Markdown plan that includes:
- **Narration Script**: A 30-35 word per scene narrative.
- **Visual Prompts**: Detailed image generation prompts for each scene.

### 2. Visual Layer (Krea AI Z-Image)
Transform prompts into high-quality cinematic images.

#### 🛠️ Customizing Your Visual Style
By default, the engine uses a "Dramatic Historical" style. You can change this to match your channel's niche in `produce-video.js`:
- **For Scenes**: Edit the `qualityTags` variable. Changing "cinematic, dramatic lighting" to "vibrant, anime style" or "minimalist, pastel colors" will completely change the video's mood.
- **For Thumbnails**: Edit the `thumbPrompt` variable. Removing "historical" and adding your own keywords (e.g., "fast-paced, colorful") will help you stand out.

#### 📏 Changing Photo Resolution
You can easily adjust the image size in `produce-video.js` inside the `generateImage` function:
- **Horizontal Videos**: Modify the `width` and `height` (default is **1280x720**).
- **Shorts**: The system automatically flips the resolution for vertical videos (default is **720x1280**).
- *Tip: If you use higher resolutions like 4K, ensure your API credits and rendering power can handle it.*

### 3. Synchronization Layer (Groq Whisper)
We use Groq's Whisper API to generate precise word-level timestamps.
- Our Remotion engine then highlights words exactly as they are spoken, creating that popular "viral" subtitle effect.

---

## 📽️ Video Styles & Ratios

### Main Horizontal Video (16:9)
- Perfectly timed for 8+ minute documentaries.
- Cinematic image transitions (Fades & Zooms).

### Social Shorts (9:16)
- Automatically derived from your main video plan.
- Centers and crops horizontal images to 9:16 automatically.
- **CTA**: Automatically adds a "Watch Full Story ↓" button.

---

## 🛠️ Metadata & Tags SEO
The system generates a `youtube-metadata-*.txt` file. You can customize the default hashtags and tags in the prompts within `produce-video.js`.
- Look for the `#History #Documentary` section and replace them with your own niche-specific tags (e.g., `#Fitness #Gains` or `#Space #Cosmos`).

---

## 📈 Optimization Tips
- **Edit Plans**: You can find every generated plan in `generated-plans/`. Edit them manually and re-run to refine!
- **Voiceover**: Change `TTS_VOICE` in `.env` to a voice that fits your niche perfectly.
