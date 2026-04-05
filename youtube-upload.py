#!/usr/bin/env python3
"""
Fully automated YouTube upload script.
Executed after Part 1 (produce-video.js) is completed.
Uses page and button timeout constants adapted from stable automation patterns.
"""

import argparse
import glob
import os
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    def load_dotenv() -> bool:
        return False

    print("WARNING: python-dotenv not found; .env could not be loaded automatically. Environment variables will be read from the system.")

load_dotenv()

# ─── Paths ────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent
VIDEO_OUT_DIR = PROJECT_ROOT / "my-video" / "out"
DEFAULT_VIDEO_FILENAME = "video.mp4"
SESSION_FILE = PROJECT_ROOT / "youtube_session" / "state.json"
CHANNEL_URL = os.getenv("YOUTUBE_CHANNEL_URL") or "https://studio.youtube.com"

# ─── Timing constants ──────────────────────────
PAGE_LOAD_TIMEOUT_MS = 60_000
WAIT_FOR_HEADER_MS = 45_000   # "Oluştur" butonu görünene kadar
WAIT_AFTER_NAVIGATE_MS = 3000  # Sayfa açıldıktan sonra ek bekleme
DELAY_BEFORE_CLICK_MS = 500    # Tıklamadan önce insan benzeri bekleme
DELAY_AFTER_OPEN_MENU_MS = 800 # Dropdown açıldıktan sonra
WAIT_FOR_MENU_ITEM_MS = 15_000 # "Video yükle" menü öğesi
WAIT_FOR_UPLOAD_DIALOG_MS = 20_000  # Yükleme diyaloğu (file picker) görünene kadar
DELAY_AFTER_DIALOG_MS = 1500   # Diyalog açıldıktan sonra file input hazır olsun diye
WAIT_FOR_METADATA_FORM_MS = 15_000   # Başlık/Açıklama formu görünene kadar
DELAY_AFTER_FILL_MS = 300            # Her alan doldurulduktan sonra
DELAY_BEFORE_NEXT_BUTTON_MS = 2500   # Bilgiler girildikten sonra İleri'ye basmadan önce bekleme


# ─── Metadata parser ──────────────────────────────────────────────────────────
def find_metadata_file() -> Path | None:
    pattern = str(PROJECT_ROOT / "youtube-metadata-*.txt")
    files = glob.glob(pattern)
    if not files:
        return None
    return Path(max(files, key=os.path.getmtime))

def parse_metadata(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    
    # Simple and reliable metadata parsing logic:
    title = ""
    description = ""
    tags = ""
    
    title_m = re.search(r"(?:TITLE|BAŞLIK)[:*]*\s*(.+)", text, re.IGNORECASE)
    if title_m:
        title = title_m.group(1).strip().strip("*")
        
    # Get everything from DESCRIPTION to TAGS (or end of file)
    desc_m = re.search(r"(?:DESCRIPTION|AÇIKLAMA)[:*]*\s*(.+?)(?:\n\s*\**\s*(?:TAGS|ETİKETLER)[:*]*|$)", text, re.IGNORECASE | re.DOTALL)
    if desc_m:
        description = desc_m.group(1).strip()
        
    tags_m = re.search(r"(?:TAGS|ETİKETLER)[:*]*\s*(.+)", text, re.IGNORECASE | re.DOTALL)
    if tags_m:
        # Handles both comma-separated single line and multi-line tags
        tags = tags_m.group(1).strip()
        # Flatten multi-line tags into a single line for YouTube (500 char limit)
        tags = tags.replace('\n', ',').replace(',,', ',')

    return {"title": title, "description": description, "keywords": tags}


# ─── Playwright helpers ───────────────────────────

def select_video_file(page, video_path: Path) -> bool:
    page.wait_for_timeout(DELAY_AFTER_DIALOG_MS)
    path_str = str(video_path.resolve())
    for selector in [
        "ytcp-uploads-file-picker input[type=file]",
        "ytcp-uploads-file-picker >> input[type=file]",
        "#ytcp-uploads-dialog-file-picker >> input[type=file]",
        "input[type=file][name='Filedata']",
    ]:
        file_input = page.locator(selector)
        try:
            file_input.first.wait_for(state="attached", timeout=5000)
            file_input.first.set_input_files(path_str)
            print(f"✅ Video selected: {video_path.name}")
            return True
        except Exception:
            continue
    print("❌ File picker input not found in upload dialog.", file=sys.stderr)
    return False

def upload_thumbnail(page, thumbnail_path: Path) -> bool:
    path_str = str(thumbnail_path.resolve())
    for selector in [
        "ytcp-video-custom-still-editor ytcp-thumbnail-uploader input#file-loader",
        "ytcp-thumbnail-uploader input[type=file][accept*='image']",
        "ytcp-thumbnail-uploader >> input[type=file]",
    ]:
        file_input = page.locator(selector)
        try:
            file_input.first.wait_for(state="attached", timeout=10000)
            file_input.first.set_input_files(path_str)
            print(f"   ✅ Thumbnail selected: {thumbnail_path.name}")
            page.wait_for_timeout(2000)
            return True
        except Exception:
            continue
    print("   ⚠️ Thumbnail uploader not found; skipping.", file=sys.stderr)
    return False

def open_and_go_to_upload(page, url: str, video_path: Path) -> bool:
    print("🌐 Opening page, waiting for load...")
    page.goto(url, wait_until="load", timeout=PAGE_LOAD_TIMEOUT_MS)
    page.wait_for_timeout(WAIT_AFTER_NAVIGATE_MS)

    olustur = page.locator('button[aria-label="Oluştur"], button[aria-label="Create"]')
    try:
        olustur.first.wait_for(state="visible", timeout=WAIT_FOR_HEADER_MS)
    except Exception:
        print("❌ 'Create' button not found. Is the session valid?", file=sys.stderr)
        return False

    page.wait_for_timeout(DELAY_BEFORE_CLICK_MS)
    olustur.first.click()
    page.wait_for_timeout(DELAY_AFTER_OPEN_MENU_MS)

    click_loc = None
    for selector in [
        'tp-yt-paper-item[test-id="upload"]',
        '[test-id="upload"]',
        'tp-yt-paper-item[role="menuitem"]:has(yt-formatted-string:has-text("Video yükle"))',
        'tp-yt-paper-item[role="menuitem"]:has(yt-formatted-string:has-text("Upload videos"))',
    ]:
        loc = page.locator(selector)
        if loc.count() > 0:
            try:
                loc.first.wait_for(state="visible", timeout=5000)
                click_loc = loc.first
                break
            except Exception:
                continue
    if click_loc is None:
        fallback = page.get_by_text("Video yükle", exact=True).or_(page.get_by_text("Upload videos", exact=True))
        try:
            fallback.first.wait_for(state="visible", timeout=WAIT_FOR_MENU_ITEM_MS)
            click_loc = fallback.first
        except Exception:
            print("❌ 'Upload videos' menu item not found.", file=sys.stderr)
            return False

    page.wait_for_timeout(DELAY_BEFORE_CLICK_MS)
    try:
        click_loc.scroll_into_view_if_needed()
        page.wait_for_timeout(200)
        click_loc.click()
    except Exception:
        try:
            click_loc.click(force=True)
        except Exception as e:
            print(f"❌ 'Video yükle' tıklanamadı: {e}", file=sys.stderr)
            return False
    print("➡️  Navigating to upload page.")

    try:
        page.locator(
            "ytcp-uploads-dialog .dialog-content, ytcp-uploads-file-picker, [id='ytcp-uploads-dialog-file-picker']"
        ).first.wait_for(state="visible", timeout=WAIT_FOR_UPLOAD_DIALOG_MS)
    except Exception:
        pass
        
    return select_video_file(page, video_path)

def fill_upload_metadata(page, info: dict, dry_run: bool = False, schedule_hour: int | None = None, schedule_minute: int = 0) -> bool:
    try:
        # Title
        title_editable = page.locator(
            'ytcp-video-metadata-editor-basics ytcp-form-input-container:has(span#label-text:has-text("Başlık")) [contenteditable="true"][role="textbox"]'
        ).or_(
            page.locator(
                'ytcp-video-metadata-editor-basics ytcp-form-input-container:has(span#label-text:has-text("Title")) [contenteditable="true"][role="textbox"]'
            )
        )
        title_editable.first.wait_for(state="visible", timeout=WAIT_FOR_METADATA_FORM_MS)
        page.wait_for_timeout(DELAY_AFTER_FILL_MS)
        el = title_editable.first
        el.click()
        page.wait_for_timeout(200)
        el.evaluate("""
            node => {
                node.focus();
                node.innerText = '';
                node.textContent = '';
                node.dispatchEvent(new Event('input', { bubbles: true }));
            }
        """)
        page.wait_for_timeout(200)
        page.keyboard.type(info["title"], delay=30)
        page.wait_for_timeout(DELAY_AFTER_FILL_MS)
        print("   ✅ Title entered.")

        # Description
        desc_editable = page.locator(
            'ytcp-video-description ytcp-form-input-container:has(span#label-text:has-text("Açıklama")) [contenteditable="true"][role="textbox"]'
        ).or_(
            page.locator(
                'ytcp-video-description ytcp-form-input-container:has(span#label-text:has-text("Description")) [contenteditable="true"][role="textbox"]'
            )
        )
        if info.get("description") and desc_editable.first.is_visible():
            desc_editable.first.click()
            page.keyboard.press("Control+a")
            page.keyboard.type(info["description"], delay=20)
            page.wait_for_timeout(DELAY_AFTER_FILL_MS)
            print("   ✅ Description entered.")
        elif info.get("description"):
            print("   ⚠️  Description box not found or not visible.", file=sys.stderr)

        # Etiketler
        if info.get("keywords"):
            tags_input = page.locator(
                'ytcp-video-metadata-editor-advanced input#text-input[aria-label="Etiketler"], '
                'ytcp-video-metadata-editor-advanced input.text-input[placeholder*="Etiket"], '
                'ytcp-free-text-chip-bar input#text-input'
            )
            try:
                tags_input.first.wait_for(state="visible", timeout=5000)
            except Exception:
                show_more = page.get_by_role("button", name="Daha fazla göster").or_(
                    page.get_by_role("button", name="Show more")
                ).or_(
                    page.locator('ytcp-button#toggle-button[aria-label="Gelişmiş ayarları göster"]')
                ).or_(page.locator('ytcp-button#toggle-button[aria-label="Show advanced settings"]'))
                try:
                    show_more.first.wait_for(state="visible", timeout=3000)
                    show_more.first.click()
                    page.wait_for_timeout(800)
                except Exception:
                    pass
            try:
                tags_input.first.wait_for(state="visible", timeout=5000)
                tags_input.first.click()
                page.keyboard.type(info["keywords"], delay=20)
                page.wait_for_timeout(DELAY_AFTER_FILL_MS)
                print("   ✅ Tags entered.")
            except Exception:
                print("   ℹ️  Tags field not found (could be a Short).")

        # Çocuklara özel değil
        not_for_kids = page.get_by_text("Hayır, çocuklara özel değil", exact=True).or_(
            page.get_by_text("No, it's not made for kids", exact=True)
        )
        try:
            not_for_kids.first.wait_for(state="visible", timeout=5000)
            not_for_kids.first.click()
            page.wait_for_timeout(DELAY_AFTER_FILL_MS)
            print("   ✅ 'Not made for kids' selected.")
        except Exception:
            pass

        if dry_run:
            print("\n🧪 --dry-run mode: Form filled but not published. Browser remains open.")
            return True

        print("Metadata entered, clicking Next buttons...")
        page.wait_for_timeout(DELAY_BEFORE_NEXT_BUTTON_MS)
        next_btn = page.locator('ytcp-button#next-button')
        
        # Ayrıntılar
        try:
            next_btn.first.wait_for(state="visible", timeout=5000)
            next_btn.first.click()
        except Exception: pass
        
        # Video Öğeleri
        page.wait_for_timeout(1500)
        try:
            next_btn.first.wait_for(state="visible", timeout=5000)
            next_btn.first.click()
        except Exception: pass
        
        # Kontroller
        page.wait_for_timeout(1500)
        try:
            next_btn.first.wait_for(state="visible", timeout=5000)
            next_btn.first.click()
        except Exception: pass
        
        # Görünürlük adımı
        page.wait_for_timeout(1500)

        if schedule_hour is not None:
            # ── ZAMANLI YAYINLAMA ──
            from datetime import datetime, timedelta
            now = datetime.now()
            publish_dt = now.replace(hour=schedule_hour, minute=schedule_minute, second=0, microsecond=0)
            if publish_dt <= now:
                publish_dt += timedelta(days=1)
            date_str = publish_dt.strftime("%m/%d/%Y")
            time_str = publish_dt.strftime("%I:%M %p")  # örn. 02:00 AM
            print(f"   ⏰ Scheduled for: {publish_dt.strftime('%Y-%m-%d %H:%M')}")

            # 'Zamanla' radyo butonunu seç
            sched_radio = (
                page.locator('tp-yt-paper-radio-button[name="SCHEDULED"]')
                .or_(page.get_by_text("Zamanla", exact=True))
                .or_(page.get_by_text("Schedule", exact=True))
            )
            try:
                sched_radio.first.wait_for(state="visible", timeout=8000)
                sched_radio.first.click()
                page.wait_for_timeout(1000)
                print("   ✅ 'Zamanla' seçildi.")
            except Exception as e:
                print(f"   ⚠️  Zamanla radyo butonu bulunamadı: {e}", file=sys.stderr)

            # Tarih gir
            date_input = (
                page.locator('ytcp-date-picker input[type="text"]')
                .or_(page.locator('input[aria-label*="tarih"], input[aria-label*="Date"], input[aria-label*="date"]'))
            )
            try:
                date_input.first.wait_for(state="visible", timeout=5000)
                date_input.first.triple_click()
                date_input.first.type(date_str, delay=50)
                page.wait_for_timeout(500)
                page.keyboard.press("Tab")
                print(f"   ✅ Date entered: {date_str}")
            except Exception as e:
                print(f"   ⚠️  Tarih girilemedi: {e}", file=sys.stderr)

            # Saat gir
            time_input = (
                page.locator('ytcp-time-of-day-picker input')
                .or_(page.locator('input[aria-label*="saat"], input[aria-label*="Time"], input[aria-label*="time"]'))
            )
            try:
                time_input.first.wait_for(state="visible", timeout=5000)
                time_input.first.triple_click()
                time_input.first.type(time_str, delay=50)
                page.wait_for_timeout(500)
                page.keyboard.press("Tab")
                print(f"   ✅ Time entered: {time_str}")
            except Exception as e:
                print(f"   ⚠️  Saat girilemedi: {e}", file=sys.stderr)

            # 'Zamanla' butonuna bas
            schedule_btn = (
                page.get_by_role("button", name="Zamanla")
                .or_(page.get_by_role("button", name="Schedule"))
            )
            try:
                schedule_btn.first.wait_for(state="visible", timeout=8000)
                page.wait_for_timeout(400)
                schedule_btn.first.click()
                print(f"\n🗓️  SCHEDULE BUTTON CLICKED! ({publish_dt.strftime('%Y-%m-%d %H:%M')})")
                page.wait_for_timeout(4000)
            except Exception as e:
                print(f"   ❌ Zamanla butonu tıklanamadı: {e}", file=sys.stderr)
                return False

        else:
            # ── ANINDA YAYINLA ──
            public_radio = page.locator('tp-yt-paper-radio-button[name="PUBLIC"]').or_(
                page.get_by_text("Herkese açık", exact=True)
            )
            try:
                public_radio.first.wait_for(state="visible", timeout=8000)
                public_radio.first.click()
                page.wait_for_timeout(800)
            except Exception as e:
                print(f"   ⚠️  Herkese açık seçilemedi: {e}", file=sys.stderr)

            publish_btn = page.get_by_role("button", name="Yayınla").or_(page.get_by_role("button", name="Publish"))
            try:
                publish_btn.first.wait_for(state="visible", timeout=5000)
                page.wait_for_timeout(400)
                publish_btn.first.click()
                print("\n🎉 PUBLISH BUTTON CLICKED!")
                page.wait_for_timeout(4000)
            except Exception:
                done_btn = page.locator("ytcp-button#done-button")
                try:
                    done_btn.first.wait_for(state="visible", timeout=3000)
                    done_btn.first.click()
                    print("\n🎉 SAVE/PUBLISH BUTTON CLICKED!")
                    page.wait_for_timeout(4000)
                except Exception as e:
                    print(f"   ❌ Yayınla butonu tıklanamadı: {e}", file=sys.stderr)
                    return False

        return True
    except Exception as e:
        print(f"Warning: Metadata form could not be filled: {e}", file=sys.stderr)
        return False

def wait_for_upload_complete(page) -> bool:
    print("⏳ Video yükleme ve işleme sürecinin tamamlanması bekleniyor...")
    try:
        locators = [
            'span.progress-label.style-scope.ytcp-video-upload-progress:has-text("Kontroller tamamlandı.")' ,
            'span.progress-label.style-scope.ytcp-video-upload-progress:has-text("Checks complete")',
            'ytcp-video-upload-progress:has-text("Kontroller tamamlandı")',
            'ytcp-video-upload-progress:has-text("Checks complete")'
        ]
        for sel in locators:
            try:
                page.locator(sel).first.wait_for(state="visible", timeout=0)
                print("✅ Video başarıyla yüklendi ve işlendi: Kontroller tamamlandı.")
                return True
            except Exception: continue
            
        print("✅ Upload stage passed.")
        return True
    except Exception:
        print("⚠️ Yükleme tamamlandı metni yakalanamadı, ancak süre doldu. Devam ediliyor.")
        return True


# ─── Shorts metadata finder ─────────────────────────────────────────────────────

def find_shorts_metadata_file() -> Path | None:
    pattern = str(PROJECT_ROOT / "youtube-metadata-shorts-*.txt")
    files = glob.glob(pattern)
    if not files:
        return None
    return Path(max(files, key=os.path.getmtime))


# ─── Video ID capture ───────────────────────────────────────────────────────────

def capture_video_id(page) -> str | None:
    """After publishing, capture the YouTube video ID via multiple strategies."""
    # Strategy 1: wait for Studio URL to contain /video/{id}/edit
    try:
        page.wait_for_url("**studio.youtube.com/video/**", timeout=20000)
        m = re.search(r'/video/([A-Za-z0-9_-]{8,12})', page.url)
        if m:
            vid_id = m.group(1)
            print(f"✅ Video ID captured (URL): {vid_id}")
            return vid_id
    except Exception:
        pass

    # Strategy 2: look for youtube.com/watch?v= link in the publish confirmation dialog
    try:
        link_loc = page.locator('a[href*="youtube.com/watch?v="]').first
        link_loc.wait_for(state="visible", timeout=10000)
        href = link_loc.get_attribute("href") or ""
        m = re.search(r'v=([A-Za-z0-9_-]{8,12})', href)
        if m:
            vid_id = m.group(1)
            print(f"✅ Video ID yakalandı (dialog link): {vid_id}")
            return vid_id
    except Exception:
        pass

    # Strategy 3: look for youtu.be/ short link
    try:
        link_loc = page.locator('a[href*="youtu.be/"]').first
        link_loc.wait_for(state="visible", timeout=5000)
        href = link_loc.get_attribute("href") or ""
        m = re.search(r'youtu\.be/([A-Za-z0-9_-]{8,12})', href)
        if m:
            vid_id = m.group(1)
            print(f"✅ Video ID yakalandı (youtu.be): {vid_id}")
            return vid_id
    except Exception:
        pass

    print("⚠️ Video ID yakalanamadı. Shorts açıklamasında placeholder kalacak.")
    return None


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="YouTube otomatik video yükleme aracı")
    parser.add_argument("--video", metavar="DOSYA", help="Özel video dosya yolu")
    parser.add_argument("--shorts", action="store_true", help="Ana videodan sonra shorts.mp4'i de yükle")
    parser.add_argument("--headless", action="store_true", help="Tarayıcıyı görüntsüz çalıştır (Linux sunucu)")
    parser.add_argument("--schedule-hour", type=int, metavar="SAAT", help="İleri tarihli yayınlama için saat (0-23)")
    parser.add_argument("--schedule-minute", type=int, default=0, metavar="DAKIKA", help="İleri tarihli yayınlama için dakika (0-59)")
    parser.add_argument("--dry-run", action="store_true", help="Yayınla butonuna basmaz")
    args = parser.parse_args()

    video_path = Path(args.video) if args.video else VIDEO_OUT_DIR / DEFAULT_VIDEO_FILENAME
    if not video_path.is_file():
        print(f"❌ Video file not found: {video_path}")
        return 1
    print(f"🎬 Ana video: {video_path}")

    meta_file = find_metadata_file()
    if not meta_file:
        print("⚠️ youtube-metadata-*.txt bulunamadı.")
        meta = {"title": "", "description": "", "keywords": ""}
    else:
        print(f"📄 Metadata okundu: {meta_file.name}")
        meta = parse_metadata(meta_file)
        if not meta["title"]:
            print("⚠️ Başlık parse edilemedi!")

    if not SESSION_FILE.is_file():
        print("❌ YouTube oturumu yok. Önce 'python youtube-login.py' çalıştırın.")
        return 1

    from playwright.sync_api import sync_playwright

    is_headless = args.headless
    launch_args = ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
    if is_headless:
        launch_args.append("--headless=new")
        print("👻 Headless mod aktif (Linux sunucu)")

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(
                channel="chrome" if not is_headless else None,
                headless=is_headless,
                args=launch_args
            )
        except Exception:
            browser = p.chromium.launch(headless=is_headless, args=launch_args)

        context = browser.new_context(storage_state=str(SESSION_FILE))
        page = context.new_page()

        # ─────────────────────────────────────────────────────────────
        # ADIM 1: ANA VİDEOYU YÜKLE
        # ─────────────────────────────────────────────────────────────
        print("\n▼ ANA VİDEO YÜKLENİYOR...")
        if not open_and_go_to_upload(page, CHANNEL_URL, video_path):
            input("\n⛔ İşlem tamamlanamadı. Kapatmak için ENTER...")
            context.close(); browser.close(); return 1

        wait_for_upload_complete(page)
        page.wait_for_timeout(2000)

        # Otomatik thumbnail algılama (produce-video.js tarafından üretilip kaydedilir)
        thumb_path = None
        for ext in ["jpg", "png"]:
            candidate = VIDEO_OUT_DIR / f"thumbnail.{ext}"
            if candidate.is_file():
                thumb_path = candidate
                print(f"🖼️ Otomatik thumbnail bulundu: {thumb_path.name}")
                break
        if thumb_path:
            upload_thumbnail(page, thumb_path)

        ok = fill_upload_metadata(
            page, meta, 
            dry_run=args.dry_run, 
            schedule_hour=args.schedule_hour, 
            schedule_minute=args.schedule_minute
        )

        # Video ID'sini yakala (Shorts için)
        main_video_url = None
        if ok and not args.dry_run:
            video_id = capture_video_id(page)
            if video_id:
                main_video_url = f"https://youtu.be/{video_id}"
                print(f"🔗 Ana video URL: {main_video_url}")

        if args.dry_run:
            input("\n🧪 Dry-run bitti. İnceleyip kapatmak için ENTER: ")
            context.close(); browser.close(); return 0 if ok else 1

        # ─────────────────────────────────────────────────────────────
        # ADIM 2: SHORTS YÜKLE (opsiyonel)
        # ─────────────────────────────────────────────────────────────
        if args.shorts and ok:
            shorts_path = VIDEO_OUT_DIR / "shorts.mp4"
            if not shorts_path.is_file():
                print(f"⚠️ shorts.mp4 bulunamadı: {shorts_path} — Shorts yükleme atlandı.")
            else:
                print("\n▼ SHORTS YÜKLENİYOR...")

                # Shorts metadata'sını bul ve {MAIN_VIDEO_URL} placeholder'ını gerçek URL ile değiştir
                shorts_meta_file = find_shorts_metadata_file()
                if shorts_meta_file:
                    print(f"📄 Shorts metadata okundu: {shorts_meta_file.name}")
                    shorts_meta = parse_metadata(shorts_meta_file)
                else:
                    print("⚠️ Shorts metadata bulunamadı. Ana metadata'dan türetiliyor.")
                    shorts_meta = dict(meta)
                    shorts_meta["title"] = (meta["title"][:85] + " #Shorts").strip()

                # URL placeholders replacement
                real_url = main_video_url or "https://youtube.com/@[YOUR_CHANNEL_HANDLE]"
                for field in ["title", "description", "keywords"]:
                    if shorts_meta.get(field):
                        shorts_meta[field] = shorts_meta[field].replace("{MAIN_VIDEO_URL}", real_url)

                # Shorts için yeni upload cycle başlat
                if not open_and_go_to_upload(page, CHANNEL_URL, shorts_path):
                    print("❌ Shorts yükleme başlatılamadı.")
                else:
                    wait_for_upload_complete(page)
                    page.wait_for_timeout(2000)
                    shorts_ok = fill_upload_metadata(
                        page, shorts_meta, 
                        dry_run=False, 
                        schedule_hour=args.schedule_hour, 
                        schedule_minute=args.schedule_minute
                    )
                    if shorts_ok:
                        print("✅ Shorts başarıyla yüklendi!")
                    else:
                        print("⚠️ Shorts metadata doldurulamadı.")

        context.close()
        browser.close()
        return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
