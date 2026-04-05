@echo off
:: ─────────────────────────────────────────────────────────────────────────────
:: run-all.bat  —  Full Automated Video Production + YouTube Upload
::
:: Usage:
::   run-all.bat "Your Topic" 20
::   run-all.bat "Your Topic" 20 shorts
:: 
:: First use (once):
::   python youtube-login.py    (Logs in to YouTube and saves the session)
:: ─────────────────────────────────────────────────────────────────────────────

set PROMPT_TEXT=%~1
set SCENE_COUNT=%~2
set SHORTS=%~3
if "%SCENE_COUNT%"=="" set SCENE_COUNT=20

if "%PROMPT_TEXT%"=="" (
    echo.
    echo Usage: run-all.bat "Topic" SceneCount [shorts]
    echo Example: run-all.bat "The Fall of Rome" 20
    echo.
    pause
    exit /b 1
)

:: Check if venv exists, if not, set it up
if not exist .venv\Scripts\python.exe (
    echo.
    echo [ERROR] .venv not found. Setting it up now...
    python -m venv .venv
    .venv\Scripts\pip install playwright
    .venv\Scripts\playwright install chromium
    echo .venv setup complete.
)
if exist .venv\Scripts\python.exe (
    .venv\Scripts\pip install python-dotenv >nul 2>&1
)

echo.
echo ===========================================================
echo  PHASE 1: Video Production Starting
echo  Topic: %PROMPT_TEXT%
echo  Scenes: %SCENE_COUNT%
if /i "%SHORTS%"=="shorts" (
    echo  Shorts: YES
) else (
    echo  Shorts: NO
)
echo ===========================================================
echo.

:: 1. Planning + TTS + Image + Timestamp generation
if /i "%SHORTS%"=="shorts" (
    node produce-video.js --prompt "%PROMPT_TEXT%" --scenes %SCENE_COUNT% --shorts
) else (
    node produce-video.js --prompt "%PROMPT_TEXT%" --scenes %SCENE_COUNT%
)
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] produce-video.js failed. Cannot continue.
    pause
    exit /b 1
)

:: 2. Remotion render
echo.
echo ===========================================================
echo  PHASE 1b: Video Rendering (Remotion)
echo ===========================================================
echo.
cd my-video
if /i "%SHORTS%"=="shorts" (
    call npm run build:all
) else (
    call npm run build
)
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Remotion render failed. Cannot continue.
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ===========================================================
echo  PHASE 2: YouTube Upload Starting
echo ===========================================================
echo.

:: 3. Automated YouTube upload
if /i "%SHORTS%"=="shorts" (
    .venv\Scripts\python youtube-upload.py --shorts
) else (
    .venv\Scripts\python youtube-upload.py
)

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] YouTube upload could not be completed.
    pause
    exit /b 1
)

echo.
echo ===========================================================
echo  COMPLETED! Video produced and uploaded to YouTube.
echo ===========================================================
echo.
pause
