#!/usr/bin/env python3
"""
Captures a YouTube session once and saves it to youtube_session/state.json.
After this, youtube-upload.py will use this session automatically.

Usage:
  python youtube-login.py
"""

import sys
from pathlib import Path

SESSION_FILE = Path(__file__).parent / "youtube_session" / "state.json"


def main() -> int:
    SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("❌ Playwright not installed. Run the following:")
        print("   python -m venv .venv")
        print("   .venv\\Scripts\\pip install playwright")
        print("   .venv\\Scripts\\playwright install chromium")
        print("   Then: .venv\\Scripts\\python youtube-login.py")
        return 1

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(
                channel="chrome",
                headless=False,
                args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
            )
        except Exception:
            browser = p.chromium.launch(headless=False)

        context = browser.new_context()
        page = context.new_page()
        page.goto("https://studio.youtube.com", wait_until="domcontentloaded")

        print("=" * 60)
        print("Browser opened!")
        print("Log in to YouTube Studio with your Google account.")
        print("After logging in, return here and press ENTER.")
        print("=" * 60)
        input("\n>> Press ENTER after you've successfully logged in: ")

        context.storage_state(path=str(SESSION_FILE))
        print(f"\n✅ Session saved: {SESSION_FILE}")
        print("Now youtube-upload.py will work fully automatically!")

        context.close()
        browser.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
