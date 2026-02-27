@echo off
TITLE Tadpole OS Launcher
echo Starting Tadpole OS...

:: Change to the project directory
cd /d "c:\Users\Home Office_PC\.gemini\antigravity\playground\tadpole-os"

:: Start the Engine in a new window
echo Launching Backend Engine...
set DATABASE_URL=sqlite:c:\Users\Home Office_PC\.gemini\antigravity\playground\tadpole-os\tadpole.db
start "Tadpole Engine" cmd /k "set DATABASE_URL=%DATABASE_URL% && npm run engine"

:: Wait a brief moment for the engine to initialize
timeout /t 3 /nobreak > nul

:: Start the Frontend in a new window
echo Launching Frontend...
start "Tadpole Frontend" cmd /k "npm run dev"

echo Tadpole OS is initializing. Terminal windows will stay open.
pause
