# 🎬 Video Production Methodology

This guide explains how the AI Video Engine works and how to customize your channel's unique look.

---

## 🏗️ Architecture Layers
The pipeline consists of four distinct AI-driven layers:

### 1. Planning Layer (Google Gemini)
Gemini generates a structured Markdown plan that includes:
- **Narration Script**: A 30-35 word per scene narrative.
- **Visual Prompts**: Detailed image generation prompts for each scene.
- **Scene Sequencing**: Intro, Content, and End Card types.

### 2. Audio Layer (Microsoft Edge TTS & Background Music)
Natural-sounding narrator voices are generated using Edge. Free, fast, and no API key required.
- **Voiceover Selection**: Choose from a variety of voices (e.g., `en-US-ChristopherNeural`, `en-GB-RyanNeural`) in your `.env` file.
- **Background Music**: 
  1. Add your `.mp3` files to `my-video/public/assets/audios/`.
  2. Map them in `produce-video.js` inside the `musicFiles` array (found near the top of the file). The system will randomly pick one for each video.

### 3. Visual Layer (Krea AI Z-Image)
Transform prompts into high-quality cinematic images.
- **Technique**: We use the Krea AI Z-Image model for its speed and cinematic feel.
- **Optimization**: The system automatically adds quality tags like `photorealistic`, `8K UHD`, and `dramatic cinematic lighting` to each prompt.

#### 🛠️ Customizing Your Visual Style
By default, the engine uses a "Dramatic Historical" style. You can change this to match your channel's niche in `produce-video.js`:
- **For Scenes**: Edit the `qualityTags` variable. Changing "cinematic, dramatic lighting" to "vibrant, anime style" or "minimalist, pastel colors" will completely change the video's mood.
- **For Thumbnails**: Edit the `thumbPrompt` variable. Removing "historical" and adding your own keywords (e.g., "fast-paced, colorful") will help you stand out.

#### 📏 Changing Photo Resolution & Manual Thumbnails
You can easily adjust the image size in `produce-video.js` inside the `generateImage` function:
- **Horizontal Videos**: Modify the `width` and `height` (default is **1280x720**).
- **Shorts**: The system automatically flips the resolution for vertical videos (default is **720x1280**).
- *Tip: If you use higher resolutions like 4K, ensure your API credits and rendering power can handle it.*
- **Manual Thumbnails**: If you don't want to use AI-generated thumbnails, you can skip it by using the `--thumbnail` flag:
  ```bash
  run-all.bat "Your Topic" 20 --thumbnail "C:/Path/to/your/custom-image.jpg"
  ```

### 4. Synchronization Layer (Groq Whisper)
To achieve "Viral Style" dynamic word-level subtitles, we use Groq's Whisper API.
- **Process**: Groq generates a JSON file with precise timestamps for **every single word**.
- **Display**: Our Remotion engine then highlights words exactly as they are spoken.

---

## 📽️ Video Styles & Ratios

### Main Horizontal Video (16:9)
- Perfectly timed for 8+ minute documentaries.
- Dynamic subtitles centered on the bottom.
- Cinematic image transitions (Fades & Zooms).

### Social Shorts (9:16)
- Automatically derived from your main video plan.
- Centers and crops horizontal images to 9:16 automatically.
- High-intensity pacing (~55s-60s).
- **CTA**: Automatically adds a "Watch Full Story ↓" button to drive traffic to your main video.

---

## 🛠️ Metadata & Tags SEO
The system generates a `youtube-metadata-*.txt` file. You can customize the default hashtags and tags in the prompts within `produce-video.js`.
- Look for the `#History #Documentary` section and replace them with your own niche-specific tags (e.g., `#Fitness #Gains` or `#Space #Cosmos`).

---

## 📈 Optimization Tips
- **Prompting**: Be specific in your `--prompt` for the best script results from Gemini.
- **Scene Count**: For 10+ minute videos, use `--scenes 40-50`.
- **Thumbnail**: The system generates a custom thumbnail for every video based on the overall topic. Check `my-video/out/thumbnail.jpg`.
- **Edit Plans**: You can find every generated plan in `generated-plans/`. Edit them manually and re-run to refine!
- **Voiceover**: Change `TTS_VOICE` in `.env` to a voice that fits your niche perfectly.