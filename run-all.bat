@echo off
:: ─────────────────────────────────────────────────────────────────────────────
:: run-all.bat  —  Full Automated Video Production + Official YouTube API Upload
:: 
:: Usage:
::   run-all.bat "Your Topic" 20
::   run-all.bat "Your Topic" 20 shorts
:: ─────────────────────────────────────────────────────────────────────────────

set PROMPT_TEXT=%~1
set SCENE_COUNT=%~2
set SHORTS_FLAG=%~3

:: Default scene count if not provided
if "%SCENE_COUNT%"=="" set SCENE_COUNT=20

if "%PROMPT_TEXT%"=="" (
    echo.
    echo Usage: run-all.bat "Your Topic" SceneCount [shorts]
    echo Example: run-all.bat "The Mysteries of Ancient Egypt" 15
    echo.
    pause
    exit /b 1
)

:: Check if virtual environment exists
if not exist .venv\Scripts\python.exe (
    echo [ERROR] Python virtual environment (.venv) not found.
    echo Please follow the instructions in SETUP.md to create it.
    pause
    exit /b 1
)

echo.
echo =======================================================
echo  PHASE 1: AI Content Generation Starting
echo  Topic  : %PROMPT_TEXT%
echo  Scenes : %SCENE_COUNT%
echo =======================================================
echo.

:: --- Phase 1: Production ---
echo.
echo [1/3] Producing video content...
if "%SHORTS_FLAG%"=="shorts" (
    echo Mode: Main Video + Shorts
    node produce-video.js --prompt "%PROMPT_TEXT%" --scenes %SCENE_COUNT% --shorts
) else (
    echo Mode: Main Video Only
    node produce-video.js --prompt "%PROMPT_TEXT%" --scenes %SCENE_COUNT%
)
if %ERRORLEVEL% neq 0 (
    echo ERROR: Production failed.
    pause
    exit /b %ERRORLEVEL%
)

:: --- Phase 2: Rendering ---
echo.
echo [2/3] Rendering with Remotion...
cd my-video
if "%SHORTS_FLAG%"=="shorts" (
    call npm run build:all
) else (
    call npm run build
)
if %ERRORLEVEL% neq 0 (
    echo ERROR: Rendering failed.
    cd ..
    pause
    exit /b %ERRORLEVEL%
)
cd ..


:: 3. Official YouTube API Upload
echo.
echo =======================================================
echo  PHASE 3: Official YouTube API Upload & Scheduling
echo =======================================================

:: We use the --schedule flag to automatically queue for 02:00 AM
if /i "%SHORTS_FLAG%"=="shorts" (
    .venv\Scripts\python youtube_api_upload.py --schedule --shorts
) else (
    .venv\Scripts\python youtube_api_upload.py --schedule
)

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] YouTube upload failed.
    pause
    exit /b 1
)

echo.
echo =======================================================
echo  🎉 SUCCESS: Video produced and scheduled for 02:00 AM!
echo =======================================================
echo.
pause
