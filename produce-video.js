const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env'), override: true });

// ─── TTS via Microsoft Edge (free, no API key) ───────────────────────────────

const TTS_VOICE = process.env.TTS_VOICE;

async function generateTTS(text, index) {
  const audioPath = path.join('my-video', 'public', 'assets', 'audios', `scene-${index}-audio.mp3`);

  if (await fs.pathExists(audioPath)) {
    console.log(`⏩ Audio already exists for scene ${index}, skipping.`);
    return audioPath;
  }

  console.log(`🎙️ Generating TTS for scene ${index} (voice: ${TTS_VOICE})...`);

  try {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
    const tts = new MsEdgeTTS();
    await tts.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    await new Promise((resolve, reject) => {
      const { audioStream } = tts.toStream(text);
      const chunks = [];
      audioStream.on('data', (chunk) => chunks.push(chunk));
      audioStream.on('end', async () => {
        try {
          await fs.writeFile(audioPath, Buffer.concat(chunks));
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      audioStream.on('error', reject);
    });

    return audioPath;
  } catch (err) {
    console.error(`❌ TTS generation failed for scene ${index}:`, err.message);
    throw err;
  }
}

// ─── Word Timestamps via Groq Whisper API (Free & Fast) ──────────────────────

async function getWordTimestamps(audioPath, index) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    throw new Error('❌ GROQ_API_KEY is not set in .env. Required for dynamic subtitles.');
  }

  // Groq Whisper for precise word-level subtitles.
  console.log(`⏱️  Extracting word timestamps for scene ${index} via Groq Whisper...`);

  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath));
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');

    const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${groqKey}`
      }
    });

    if (response.data && response.data.words) {
      return response.data.words; // Array of { word, start, end }
    } else {
      console.warn(`⚠️ No words array returned from Groq for scene ${index}. Using fallback.`);
      return [];
    }
  } catch (err) {
    console.error(`❌ Groq API error for scene ${index}:`, err.response?.data || err.message);
    return []; // Return empty array rather than totally crashing the pipeline
  }
}

// ─── Image via Krea AI API (Z-Image) ──────────────────────────────────────────

async function generateImage(prompt, index) {
  const imagePath = path.join('my-video', 'public', 'assets', 'images', `scene-${index}-image.jpg`);

  if (await fs.pathExists(imagePath)) {
    console.log(`⏩ Image already exists for scene ${index}, skipping.`);
    return imagePath;
  }

  const kreaKey = process.env.KREA_API_KEY;
  if (!kreaKey) {
    throw new Error('❌ KREA_API_KEY is not set in .env. Required for Z-Image generation.');
  }

  const kreaModel = process.env.KREA_MODEL || 'z-image';
  const qualityTags = 'photorealistic, ultra-detailed, professional photography, dramatic cinematic lighting, 8K UHD';
  const fullPrompt = `${prompt}, ${qualityTags}`;

  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`\n⏳ Retry attempt ${attempt}/${maxAttempts} for scene ${index}...`);
        await new Promise(r => setTimeout(r, 5000)); // Wait 5s before retry
      }

      // 1. Submit the job
      const submitUrl = `https://api.krea.ai/generate/image/${kreaModel}/${kreaModel}`;
      const submitRes = await axios.post(submitUrl, {
        prompt: fullPrompt,
        width: 1280,
        height: 720
      }, {
        headers: {
          'Authorization': `Bearer ${kreaKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const jobId = submitRes.data.job_id;
      if (!jobId) {
        throw new Error('Failed to get job_id from Krea AI');
      }

      // 2. Poll for the result
      let imageUrl = null;
      const pollingAttempts = 60; 
      for (let i = 0; i < pollingAttempts; i++) {
        await new Promise(r => setTimeout(r, 2000)); // Poll every 2s
        const statusRes = await axios.get(`https://api.krea.ai/jobs/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${kreaKey}`,
            'Accept': 'application/json'
          }
        });

        const data = statusRes.data;
        if (data.status === 'completed' && data.result && data.result.urls && data.result.urls[0]) {
          imageUrl = data.result.urls[0];
          break;
        } else if (data.status === 'failed') {
          throw new Error(`Krea job failed: ${data.error || 'Unknown error'}`);
        }
        process.stdout.write('.');
      }

      if (!imageUrl) throw new Error('Krea generation timed out.');

      // 3. Download the image
      const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      await fs.writeFile(imagePath, imgRes.data);
      console.log(`\n✅ Image saved: ${imagePath}`);
      return imagePath;

    } catch (err) {
      lastError = err;
      const errMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.warn(`\n⚠️  Krea AI attempt ${attempt} failed for scene ${index}: ${errMsg}`);
      
      if (attempt === maxAttempts) {
        console.error(`❌ All ${maxAttempts} Krea AI attempts failed.`);
        throw lastError;
      }
    }
  }
}


// ─── Thumbnail via Krea AI (YouTube 1280×720) ────────────────────────────

async function generateThumbnail(topic) {
  const thumbPath = path.join('my-video', 'out', 'thumbnail.jpg');
  await fs.ensureDir(path.join('my-video', 'out'));

  if (await fs.pathExists(thumbPath)) {
    console.log(`⏩ Thumbnail already exists, skipping.`);
    return thumbPath;
  }

  const kreaKey = process.env.KREA_API_KEY;
  if (!kreaKey) {
    console.warn(`⚠️ KREA_API_KEY is missing — thumbnail generation skipped.`);
    return null;
  }

  // ── Get a thumbnail-optimized prompt from Gemini ──────────────────────────
  // Customize the default style below (e.g., dramatic, intense, cinematic) to fit your niche.
  let thumbPrompt = `${topic}, dramatic historical scene, intense cinemeatic lighting, powerful composition, eye-catching, cinematic poster style, photorealistic, 8K, no text, no logos`;

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`\n⏳ Gemini thumbnail prompt attempt ${attempt}/${maxAttempts}...`);
          await new Promise(r => setTimeout(r, 5000));
        }

        const model = process.env.GEMINI_TEXT_MODEL;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const res = await axios.post(url, {
          contents: [{
            parts: [{
              text:
                `Write ONE image generation prompt for a YouTube thumbnail about: "${topic}".
Requirements:
- Visually dramatic and emotionally intense
- Cinematic lighting (golden hour, fire, storm, dramatic contrast)
- Specific scene (not abstract) — show a key historical moment or character
- **CRITICAL**: No text, no YouTube logos, no buttons, and no UI elements in the image. Pure visual description only.
- Max 2 sentences, no hashtags, no explanations
Output only the prompt text.` }]
          }],
          generationConfig: { temperature: 0.8 }
        }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });

        const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text && text.length > 20) {
          thumbPrompt = text;
          console.log(`🖼️  Thumbnail prompt: ${thumbPrompt.slice(0, 80)}...`);
        }
        break; // Success! Exit retry loop
      } catch (err) {
        console.warn(`⚠️ Thumbnail prompt attempt ${attempt} failed: ${err.message}`);
        if (attempt === maxAttempts) {
          console.warn(`⚠️ All Gemini thumbnail prompt attempts failed, using fallback.`);
        }
      }
    }
  }

  const kreaModel = process.env.KREA_MODEL || 'z-image';
  console.log(`🖼️  Generating thumbnail via Krea AI (${kreaModel})...`);

  try {
    // 1. Submit
    const submitUrl = `https://api.krea.ai/generate/image/${kreaModel}/${kreaModel}`;
    const submitRes = await axios.post(submitUrl, {
      prompt: `${thumbPrompt}, photorealistic, 8K UHD`,
      width: 1280,
      height: 720
    }, {
      headers: {
        'Authorization': `Bearer ${kreaKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const jobId = submitRes.data.job_id;
    if (!jobId) return null;

    // 2. Poll
    let imageUrl = null;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await axios.get(`https://api.krea.ai/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${kreaKey}`,
          'Accept': 'application/json'
        }
      });
      const data = statusRes.data;
      if (data.status === 'completed' && data.result && data.result.urls && data.result.urls[0]) {
        imageUrl = data.result.urls[0];
        break;
      } else if (data.status === 'failed') {
        break;
      }
    }

    if (imageUrl) {
      const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      await fs.writeFile(thumbPath, imgRes.data);
      console.log(`\n✅ Thumbnail saved: ${thumbPath}`);
      return thumbPath;
    }
    return null;
  } catch (err) {
    console.error(`❌ Krea AI Thumbnail failure:`, err.response?.data || err.message);
    return null;
  }
}

// ─── Background music (free, SoundHelix) ─────────────────────────────────────
async function downloadBackgroundMusic() {
  const musicPath = path.join('my-video', 'public', 'assets', 'audios', 'background.mp3');
  if (await fs.pathExists(musicPath)) {
    console.log(`⏩ Background music already exists, skipping.`);
    return musicPath;
  }
  console.log(`🎵 Downloading background music...`);
  const url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    await fs.writeFile(musicPath, response.data);
    return musicPath;
  } catch (err) {
    console.error(`❌ Failed to download background music:`, err.message);
    throw err;
  }
}

// ─── Audio duration ───────────────────────────────────────────────────────────

async function getAudioDuration(filepath) {
  const mm = await import('music-metadata');
  const metadata = await mm.parseFile(filepath);
  return metadata.format.duration;
}

// ─── AI plan generation via Google AI Studio (Gemini) ───────────────────────

async function generateMarkdownPlan(prompt, sceneCount) {
  console.log(`\n🤖 Generating ${sceneCount}-scene plan for: "${prompt}"`);

  const sceneTemplate = `### Scene N: Title
- **Type:** TYPE
- **Video Prompt:** "8K cinematic image description"
- **Voiceover:** "30-35 word narration"
- **Transition:** fade`;

  const sysPrompt = `Write a ${sceneCount}-scene YouTube video script in markdown for: "${prompt}". Output ONLY raw markdown, no explanations. Use this EXACT format for each scene (scene 1 is intro type, last scene is endCard type, rest are image type):

${sceneTemplate}

CRITICAL RULES:
1. For the FINAL scene (endCard type), the **Video Prompt** MUST be clean, WITHOUT any text, buttons, YouTube logos, arrows, or UI elements. It should be purely visual.
2. Ensure image prompts for other scenes also avoid text where possible.

Write all ${sceneCount} scenes now:`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('❌ GEMINI_API_KEY is not set in .env. Please add it to generate plans and metadata.');
  }

  const model = process.env.GEMINI_TEXT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`\n⏳ Gemini plan generation attempt ${attempt}/${maxAttempts}...`);
        await new Promise(r => setTimeout(r, 5000)); // Wait 5s before retry
      }

      const response = await axios.post(url, {
        contents: [{ parts: [{ text: sysPrompt }] }],
        generationConfig: { temperature: 0.7 }
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000
      });

      let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        text = JSON.stringify(response.data);
      }

      const slug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const filename = `plan-${slug}-${sceneCount}scenes.md`;
      await fs.ensureDir('generated-plans');
      const filepath = path.join('generated-plans', filename);
      await fs.writeFile(filepath, text, 'utf-8');
      console.log(`✅ Plan saved to ${filepath}`);
      return filepath;

    } catch (error) {
      lastError = error;
      const errMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      console.warn(`\n⚠️  Gemini plan attempt ${attempt} failed: ${errMsg}`);
      
      if (attempt === maxAttempts) {
        if (error.response?.data) {
          console.error('❌ Final Google API Error:', JSON.stringify(error.response.data, null, 2));
        }
        console.error('❌ Failed to generate plan after all attempts:', error.message);
        process.exit(1);
      }
    }
  }
}

// ─── Shorts storyboard (4-5 scenes, ~55s, portrait 9:16) ─────────────────────

function generateShortsScenes(allScenes) {
  const n = allScenes.length;
  // Spread picks: intro + 2 peak moments + climax + outro
  const rawIndices = [
    0,
    Math.round(n * 0.25),
    Math.round(n * 0.5),
    Math.round(n * 0.75),
    n - 1
  ];
  const indices = [...new Set(rawIndices)]; // dedupe

  // Mark last scene as CTA
  const scenes = indices.map((i, pos) => ({
    ...allScenes[i],
    showCTA: pos === indices.length - 1
  }));

  // Cap total to ~60s — trim from middle if over
  let total = scenes.reduce((s, sc) => s + sc.durationInSeconds, 0);
  while (total > 62 && scenes.length > 3) {
    scenes.splice(Math.floor(scenes.length / 2), 1);
    total = scenes.reduce((s, sc) => s + sc.durationInSeconds, 0);
  }

  return scenes;
}

// ─── YouTube metadata generation ──────────────────────────────────────────────

async function generateYouTubeMetadata(topic, scenes, totalMin, outputSlug) {
  console.log(`\n📝 Generating YouTube metadata...`);

  // ── Build exact cumulative timestamps from real audio durations ──────────────
  let cumulative = 0;
  const sceneTimingLines = scenes.map((sc, idx) => {
    const mm = Math.floor(cumulative / 60);
    const ss = Math.round(cumulative % 60).toString().padStart(2, '0');
    const label = sc.narration
      ? sc.narration.split(/[.!?]/)[0].trim().slice(0, 60)
      : `Scene ${idx + 1}`;
    const line = `${mm}:${ss} - ${label}`;
    cumulative += sc.durationInSeconds;
    return line;
  });

  const metaPrompt = `Write YouTube metadata for a cinematic history documentary video titled "${topic}" (${totalMin} minutes) on the "[YOUR_CHANNEL_NAME]" channel.

TITLE: [under 70 chars, curiosity-driven, power words]

DESCRIPTION:
[3-4 sentence dramatic hook about the topic]

[2-3 sentences on what viewers will discover]

[Subscribe/like call to action]

Timestamps:
IMPORTANT: Use ONLY the exact timestamps listed below. Do NOT invent, adjust, or reorder them. Copy them verbatim:
${sceneTimingLines.join('\n')}

#History #Documentary #VisualStorytelling

TAGS: [15 comma-separated SEO tags]`;

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_TEXT_MODEL;

  if (!apiKey) {
    console.warn(`⚠️ GEMINI_API_KEY not found. Falling back to default metadata.`);
    const filename = `youtube-metadata-${outputSlug}.txt`;
    await fs.writeFile(filename, buildFallbackMetadata(topic, totalMin, sceneTimingLines), 'utf-8');
    return filename;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`\n⏳ Gemini metadata generation attempt ${attempt}/${maxAttempts}...`);
        await new Promise(r => setTimeout(r, 5000));
      }

      const response = await axios.post(url, {
        contents: [{ parts: [{ text: metaPrompt }] }],
        generationConfig: { temperature: 0.7 }
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 90000
      });

      let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text || text.length < 50) {
        console.warn(`⚠️ Gemini returned short/empty metadata. Using fallback.`);
        text = buildFallbackMetadata(topic, totalMin, sceneTimingLines);
      }

      const filename = `youtube-metadata-${outputSlug}.txt`;
      await fs.writeFile(filename, text, 'utf-8');
      console.log(`✅ YouTube metadata saved: ${filename}`);
      return filename;

    } catch (err) {
      lastError = err;
      const errMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.warn(`\n⚠️  YouTube metadata attempt ${attempt} failed: ${errMsg}`);
      
      if (attempt === maxAttempts) {
        console.warn(`⚠️ All Gemini metadata attempts failed, using fallback.`);
        const filename = `youtube-metadata-${outputSlug}.txt`;
        await fs.writeFile(filename, buildFallbackMetadata(topic, totalMin, sceneTimingLines), 'utf-8');
        return filename;
      }
    }
  }
}

function buildFallbackMetadata(topic, totalMin, sceneTimingLines) {
  return `TITLE: ${topic} | [YOUR_CHANNEL_NAME]

DESCRIPTION:
The story of ${topic} — one of history's most dramatic collapses. What really happened, and why did no one see it coming?

In this ${totalMin}-minute cinematic documentary, we trace the rise, the warning signs, and the final collapse. History has lessons — if we're willing to read them.

Subscribe for more cinematic history: @[YOUR_CHANNEL_HANDLE] | Like if this made you think.

Timestamps:
${sceneTimingLines.join('\n')}

#History #Documentary #Educational

TAGS: ${topic}, history documentary, cinematic history, collapse, ancient history, documentary, rise and fall, historical documentary, YouTube documentary`;
}

// ─── Shorts YouTube Metadata ──────────────────────────────────────────────────

async function generateShortsYouTubeMetadata(topic, shortsDurationSec, outputSlug) {
  console.log(`\n📱 Generating Shorts metadata (Gemini)...`);

  const approxSec = Math.round(shortsDurationSec);

  const shortsPrompt = `Write YouTube Shorts metadata for a ~${approxSec}-second teaser clip about "${topic}" for the "[YOUR_CHANNEL_NAME]" cinematic history channel.

TITLE: [under 90 chars, hook-driven, punchy — do NOT include #Shorts in the title]

DESCRIPTION:
[1-2 punchy sentences that tease the topic and create curiosity]
\n▶ Full Story: {MAIN_VIDEO_URL}\n
#Shorts #History #Documentary #HistoricalFacts

TAGS: [10 comma-separated tags — include: Shorts, Short, history, documentary]`;

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_TEXT_MODEL;

  if (!apiKey) {
    const filename = `youtube-metadata-shorts-${outputSlug}.txt`;
    await fs.writeFile(filename, buildFallbackShortsMetadata(topic), 'utf-8');
    return filename;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`\n⏳ Gemini Shorts metadata attempt ${attempt}/${maxAttempts}...`);
        await new Promise(r => setTimeout(r, 5000));
      }

      const response = await axios.post(url, {
        contents: [{ parts: [{ text: shortsPrompt }] }],
        generationConfig: { temperature: 0.7 }
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      });

      let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text || text.length < 30) {
        console.warn(`⚠️ Gemini returned empty Shorts metadata. Using fallback.`);
        text = buildFallbackShortsMetadata(topic);
      }

      const filename = `youtube-metadata-shorts-${outputSlug}.txt`;
      await fs.writeFile(filename, text, 'utf-8');
      console.log(`✅ Shorts metadata saved: ${filename}`);
      return filename;

    } catch (err) {
      lastError = err;
      const errMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.warn(`\n⚠️  Shorts metadata attempt ${attempt} failed: ${errMsg}`);
      
      if (attempt === maxAttempts) {
        console.warn(`⚠️ All Gemini Shorts metadata attempts failed, using fallback.`);
        const filename = `youtube-metadata-shorts-${outputSlug}.txt`;
        await fs.writeFile(filename, buildFallbackShortsMetadata(topic), 'utf-8');
        return filename;
      }
    }
  }
}

function buildFallbackShortsMetadata(topic) {
  return `TITLE: ${topic} — A 60-Second History

DESCRIPTION:
The story of ${topic} in under a minute. The full truth is more dramatic than you think.

▶ Full Story: {MAIN_VIDEO_URL}

#Shorts #History #Documentary #EpicHistory

TAGS: ${topic}, history shorts, short, shorts, history documentary, historical facts, documentary short, history channel, cinematic`;
}

// ─── Markdown parser ──────────────────────────────────────────────────────────

async function parseMarkdown(filepath) {
  const content = await fs.readFile(filepath, 'utf-8');
  const lines = content.split('\n');
  const scenes = [];
  let currentScene = null;

  for (const line of lines) {
    const trim = line.trim();
    if (trim.startsWith('### Scene ')) {
      if (currentScene && currentScene.videoPrompt && currentScene.voiceover) {
        scenes.push(currentScene);
      }
      currentScene = {
        title: trim.replace('###', '').trim(),
        transition: 'fade',
        type: 'image'
      };
    } else if (currentScene) {
      if (trim.startsWith('- **Type:**')) {
        currentScene.type = trim.split('**Type:**')[1].trim();
      } else if (trim.startsWith('- **Video Prompt:**')) {
        currentScene.videoPrompt = trim.split('**Video Prompt:**')[1].trim().replace(/^["']|["']$/g, '').trim();
      } else if (trim.startsWith('- **Voiceover:**')) {
        currentScene.voiceover = trim.split('**Voiceover:**')[1].trim().replace(/^["']|["']$/g, '').trim();
      } else if (trim.startsWith('- **Transition:**')) {
        currentScene.transition = trim.split('**Transition:**')[1].trim();
      }
    }
  }
  if (currentScene && currentScene.videoPrompt && currentScene.voiceover) {
    scenes.push(currentScene);
  }

  return scenes;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  let mdFilePath;
  let promptText;
  let sceneCount = 20;
  const enableShorts = args.includes('--shorts');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prompt' && args[i + 1]) {
      promptText = args[i + 1];
      i++;
    } else if (args[i] === '--scenes' && args[i + 1]) {
      sceneCount = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i].endsWith('.md')) {
      mdFilePath = args[i];
    }
  }

  if (!promptText && !mdFilePath) {
    console.log('Usage:');
    console.log('  node produce-video.js --prompt "Your topic" [--scenes 20] [--shorts]');
    console.log('  node produce-video.js your-plan.md [--shorts]');
    process.exit(1);
  }

  const audioDir = path.join('my-video', 'public', 'assets', 'audios');
  const imageDir = path.join('my-video', 'public', 'assets', 'images');

  await fs.ensureDir(audioDir);
  await fs.ensureDir(imageDir);
  await fs.ensureDir(path.join('my-video', 'src', 'data'));
  await fs.ensureDir('generated-plans');

  // Clean previous run outputs (metadata, plans, and old scene assets)
  const rootFiles = await fs.readdir('.');
  for (const f of rootFiles) {
    if (f.startsWith('youtube-metadata-') && f.endsWith('.txt')) {
      await fs.remove(f);
    }
  }
  const planFiles = await fs.readdir('generated-plans');
  for (const f of planFiles) {
    await fs.remove(path.join('generated-plans', f));
  }

  // Clean old scene audios and images so they aren't reused
  const oldAudios = await fs.readdir(audioDir);
  for (const f of oldAudios) {
    if (f.startsWith('scene-')) await fs.remove(path.join(audioDir, f));
  }
  const oldImages = await fs.readdir(imageDir);
  for (const f of oldImages) {
    if (f.startsWith('scene-')) await fs.remove(path.join(imageDir, f));
  }

  // Clean old custom thumbnails
  const outDir = path.join('my-video', 'out');
  await fs.ensureDir(outDir);
  const outFiles = await fs.readdir(outDir);
  for (const f of outFiles) {
    if (f === 'thumbnail.jpg' || f === 'thumbnail.png') {
      await fs.remove(path.join(outDir, f));
    }
  }

  if (promptText) {
    mdFilePath = await generateMarkdownPlan(promptText, sceneCount);
  }

  console.log(`\n📖 Parsing plan: ${mdFilePath}`);
  const scenesRaw = await parseMarkdown(mdFilePath);

  if (scenesRaw.length === 0) {
    console.error('❌ Parsed 0 scenes. Check the markdown format: ### Scene X: Title');
    process.exit(1);
  }

  const topic = promptText || path.basename(mdFilePath, '.md');
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);

  console.log(`✅ Found ${scenesRaw.length} scenes.\n`);

  const storyboardData = {
    scenes: [],
    musicFile: 'background.mp3'
  };

  for (let i = 0; i < scenesRaw.length; i++) {
    const sceneNum = i + 1;
    const scene = scenesRaw[i];

    console.log(`── Scene ${sceneNum}/${scenesRaw.length}: ${scene.title}`);

    // 1. TTS audio — duration drives scene length (no artificial minimum)
    const audioPath = await generateTTS(scene.voiceover, sceneNum);
    const wordTimestamps = await getWordTimestamps(audioPath, sceneNum);

    const ttsDuration = await getAudioDuration(audioPath);
    const sceneDurationInSeconds = ttsDuration + 1.0; // 1s padding after speech

    // 2. Scene image — keep spacing between requests for stable provider behavior
    const imageDelay = 10000;
    if (sceneNum > 1) {
      console.log(`   ⏳ Waiting 10s before next image generation...`);
      await new Promise(r => setTimeout(r, imageDelay));
    }
    await generateImage(scene.videoPrompt, sceneNum);

    storyboardData.scenes.push({
      id: `scene${sceneNum}`,
      type: scene.type,
      durationInSeconds: sceneDurationInSeconds,
      narration: scene.voiceover,
      wordTimestamps: wordTimestamps,
      imageFile: `scene-${sceneNum}-image.jpg`,
      audioFile: `scene-${sceneNum}-audio.mp3`,
      transition: scene.transition
    });
  }

  // 3. Background music
  await downloadBackgroundMusic();

  const totalSec = storyboardData.scenes.reduce((s, sc) => s + sc.durationInSeconds, 0);
  const totalMin = Math.floor(totalSec / 60);
  const totalSecRem = Math.round(totalSec % 60);

  const sbPath = path.join('my-video', 'src', 'data', 'storyboard.json');
  await fs.writeJson(sbPath, storyboardData, { spaces: 2 });

  // Optionally generate Shorts storyboard + metadata
  if (enableShorts) {
    const shortsScenes = generateShortsScenes(storyboardData.scenes);
    const shortsDuration = shortsScenes.reduce((s, sc) => s + sc.durationInSeconds, 0);
    const shortsData = { scenes: shortsScenes, musicFile: 'background.mp3' };
    const shortsPath = path.join('my-video', 'src', 'data', 'shorts.json');
    await fs.writeJson(shortsPath, shortsData, { spaces: 2 });
    console.log(`📱 Shorts storyboard saved: ${shortsPath} (${shortsScenes.length} scenes, ${Math.round(shortsDuration)}s)`);
    await generateShortsYouTubeMetadata(topic, shortsDuration, slug);
  } else {
    console.log('📱 Shorts generation disabled (run with --shorts to enable).');
  }

  console.log(`\n✅ Storyboard saved: ${sbPath}`);
  console.log(`🎬 Total video length: ${totalMin}m ${totalSecRem}s (${scenesRaw.length} scenes)`);

  if (totalMin < 8) {
    console.log(`⚠️  Video is ${totalMin}m ${totalSecRem}s. For 8+ minutes, use --scenes 35 or write longer voiceovers.`);
  }

  // 4. Thumbnail + YouTube metadata
  await generateThumbnail(topic);
  await generateYouTubeMetadata(topic, storyboardData.scenes, totalMin, slug);

  console.log(`\n🎉 Done! Now render the video:`);
  console.log(`   cd my-video`);
  if (enableShorts) {
    console.log(`   npm run build:all   # main video + Shorts`);
  } else {
    console.log(`   npm run build       # only main video`);
  }
  console.log();
}

main().catch(err => {
  console.error('\n❌ CRITICAL FAILURE:', err.message || err);
  process.exit(1);
});
