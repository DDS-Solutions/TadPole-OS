@echo off
echo 🛑 Shutting down Tadpole OS (CMD Edition)...

echo 🔍 Searching for process on port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    echo ⏹️ Terminating process %%a...
    taskkill /F /PID %%a
)

echo 🔍 Searching for process on port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    echo ⏹️ Terminating process %%a...
    taskkill /F /PID %%a
)

echo 🧹 Cleaning up stray Node/TSX processes...
taskkill /F /IM node.exe /T
taskkill /F /IM tsx.exe /T

echo ✅ Tadpole OS has been shut down.
