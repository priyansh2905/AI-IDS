# AI-HIDS Launcher Script
# Starts local backend services:
#   - FastAPI Analytics Backend: Starts in a separate background window (port 8001)
#   - HIDS Telemetry Agent: Starts in the active foreground terminal (simulate mode)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  AI-Powered Host Intrusion Detection System " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Capture project root once so subshells get the correct absolute path
$ProjectRoot = $PWD.Path

# --- 1. Launch FastAPI Analytics Backend (port 8001) --------------------------
Write-Host "[*] Launching FastAPI Analytics Backend on http://127.0.0.1:8001..." -ForegroundColor Yellow
$fastapiCmd = "Set-Location '$ProjectRoot\backend'; `$Host.UI.RawUI.WindowTitle = 'AI-HIDS FastAPI Backend'; python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $fastapiCmd
Start-Sleep -Seconds 2

# --- 2. Launch HIDS Agent in CURRENT Terminal (simulate mode) -----------------
Write-Host "[*] Launching HIDS Telemetry Agent in current window..." -ForegroundColor Yellow
Write-Host "---------------------------------------------" -ForegroundColor Gray
Set-Location "$ProjectRoot\backend"
python agent.py --simulate --backend http://127.0.0.1:8001
