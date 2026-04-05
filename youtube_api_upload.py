#!/usr/bin/env python3
"""
Official YouTube Data API v3 Uploader.
Bypasses manual browser interactions and "Verify Identity" popups.
Requires client_secrets.json from Google Cloud Console.
"""

import os
import re
import glob
import sys
import argparse
from pathlib import Path
from datetime import datetime, timedelta, timezone

# Google API Libraries
try:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
except ImportError:
    print("❌ Missing libraries. Install them using:")
    print(".\.venv\Scripts\python -m pip install google-api-python-client google-auth-oauthlib google-auth-httplib2")
    sys.exit(1)

# --- Configuration ---
PROJECT_ROOT = Path(__file__).resolve().parent
VIDEO_OUT_DIR = PROJECT_ROOT / "my-video" / "out"
CLIENT_SECRETS_FILE = PROJECT_ROOT / "client_secrets.json"
TOKEN_FILE = PROJECT_ROOT / "token.json"
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]

def authenticate():
    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CLIENT_SECRETS_FILE.exists():
                print(f"❌ '{CLIENT_SECRETS_FILE.name}' not found. Please download it from Google Cloud Console.")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRETS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)
        
        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())
    
    return build("youtube", "v3", credentials=creds)

def parse_metadata(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    title = ""
    description = ""
    tags = ""
    
    title_m = re.search(r"(?:TITLE|BAŞLIK)[:*]*\s*(.+)", text, re.IGNORECASE)
    if title_m: title = title_m.group(1).strip().strip("*")
        
    desc_m = re.search(r"(?:DESCRIPTION|AÇIKLAMA)[:*]*\s*(.+?)(?:\n\s*\**\s*(?:TAGS|ETİKETLER)[:*]*|$)", text, re.IGNORECASE | re.DOTALL)
    if desc_m: description = desc_m.group(1).strip()
        
    tags_m = re.search(r"(?:TAGS|ETİKETLER)[:*]*\s*(.+)", text, re.IGNORECASE | re.DOTALL)
    if tags_m:
        tags = tags_m.group(1).strip().replace('\n', ',').replace(',,', ',')

    return {"title": title, "description": description, "tags": [t.strip() for t in tags.split(",") if t.strip()]}

def upload_video(youtube, video_path, meta, privacy="private", schedule_time=None):
    print(f"🚀 Uploading video: {video_path.name}")
    
    # 📅 Scheduling Logic
    publish_at = None
    if schedule_time:
        privacy = "private"
        publish_at = schedule_time
        print(f"📅 Scheduled publish time (UTC): {publish_at}")

    body = {
        "snippet": {
            "title": meta["title"][:100],
            "description": meta["description"][:5000],
            "tags": meta["tags"][:50],
            "categoryId": "22"  # People & Blogs
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False
        }
    }
    
    if publish_at:
        body["status"]["publishAt"] = publish_at

    media = MediaFileUpload(str(video_path), chunksize=-1, resumable=True)
    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media
    )
    
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"📈 Progress: {int(status.progress() * 100)}%")
            
    print(f"✅ Video uploaded successfully! ID: {response['id']}")
    return response["id"]

def set_thumbnail(youtube, video_id, thumbnail_path):
    print(f"🖼️  Setting thumbnail: {thumbnail_path.name}")
    try:
        request = youtube.thumbnails().set(
            videoId=video_id,
            media_body=MediaFileUpload(str(thumbnail_path))
        )
        request.execute()
        print("✅ Thumbnail updated.")
    except Exception as e:
        print(f"⚠️  Could not set thumbnail: {e}")

def get_latest_metadata(is_shorts=False):
    pattern = "youtube-metadata-shorts-*.txt" if is_shorts else "youtube-metadata-*.txt"
    files = glob.glob(str(PROJECT_ROOT / pattern))
    if not files: return None
    return Path(max(files, key=os.path.getmtime))

def get_next_2am_iso():
    """Calculates the next occurrence of 02:00 AM local time in UTC ISO format."""
    now = datetime.now()
    # Target 02:00:00 today
    scheduled_time = now.replace(hour=2, minute=0, second=0, microsecond=0)
    
    # If 02:00 has already passed today, schedule for tomorrow
    if now >= scheduled_time:
        scheduled_time += timedelta(days=1)
    
    # Python 3.6+ clean UTC conversion (ISO 8601)
    return scheduled_time.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", help="Path to video file")
    parser.add_argument("--shorts", action="store_true", help="Upload shorts.mp4 instead")
    parser.add_argument("--privacy", default="public", choices=["public", "private", "unlisted"])
    parser.add_argument("--schedule", action="store_true", help="Schedule for next 02:00 AM local time")
    args = parser.parse_args()

    # Determine files
    video_file = VIDEO_OUT_DIR / ("shorts.mp4" if args.shorts else "video.mp4")
    if args.video: video_file = Path(args.video)
    
    if not video_file.is_file():
        print(f"❌ Video file not found: {video_file}")
        return 1

    meta_file = get_latest_metadata(args.shorts)
    if not meta_file:
        print("❌ Metadata file not found (make sure production script ran successfully).")
        return 1
    
    meta = parse_metadata(meta_file)
    youtube = authenticate()
    
    # Schedule logic
    schedule_time = get_next_2am_iso() if args.schedule else None

    # 1. Upload Video
    video_id = upload_video(youtube, video_file, meta, args.privacy, schedule_time)
    
    # 2. Upload Thumbnail (Main video only or if thumbnail exists)
    thumb_path = VIDEO_OUT_DIR / "thumbnail.jpg"
    if thumb_path.is_file() and not args.shorts:
        set_thumbnail(youtube, video_id, thumb_path)

    return 0

if __name__ == "__main__":
    sys.exit(main())
