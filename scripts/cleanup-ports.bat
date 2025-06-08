@echo off
REM WSLog Port Cleanup Script for Windows
REM Kills processes on ports used by WSLog system

echo 🧹 WSLog Port Cleanup (Windows)
echo ===============================

set PORTS=3000 8085
set FOUND_PROCESSES=false

for %%P in (%PORTS%) do (
    echo Checking port %%P...
    
    REM Find processes on this port
    for /f "tokens=5" %%i in ('netstat -ano ^| findstr :%%P') do (
        set PID=%%i
        if not "%%i"=="" (
            echo 🔍 Found process on port %%P: PID %%i
            set FOUND_PROCESSES=true
            
            REM Kill the process
            echo 💀 Killing PID %%i...
            taskkill /PID %%i /F >nul 2>&1
            if errorlevel 1 (
                echo ⚠️  Failed to kill PID %%i
            ) else (
                echo ✅ Killed PID %%i
            )
        )
    )
)

if "%FOUND_PROCESSES%"=="false" (
    echo ✨ All ports were already clear!
)

echo.
echo 🚀 Ready to start WSLog!
echo    Run: pnpm dev
echo    Or:  pnpm fresh-start

pause