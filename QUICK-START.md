# ⚡ Quick Start Guide

Ready to create your first AI-generated video? Follow these 4 quick steps:

## 1. Installation
Ensure Node.js and Python are installed. Install all dependencies as described in the [Setup Guide](./SETUP.md).

---

## 2. API Configuration
1. Open `.env` and enter your API keys for **Gemini**, **Krea**, and **Groq**.
2. Download your `client_secrets.json` from Google Cloud Console.

---

## 3. Official YouTube API Auth
Run the auth script **once** to create your `token.json`:
```powershell
.\.venv\Scripts\python youtube_api_upload.py
```
A browser window will open. Authorize your channel and once the terminal says "Success", you are ready!

---

## 4. One-Click Production!
Run the batch script with your topic and desired scene count:
```bash
# Example: 20 scenes about Ancient Greece
run-all.bat "Ancient Greece Mythology" 20
```
This script will:
1. Generate the script, voices, and images.
2. Render the final MP4.
3. Upload and **schedule** the video for 02:00 AM automatically.

---

## 💡 Pro Tip
Check `generated-plans/` to see the raw scripts. You can manually edit these markdown files if you want to refine the AI's output before rendering!
