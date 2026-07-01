# AI-HIDS Launcher Script
# Run this script in PowerShell to launch the full-stack system

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   AI-Powered Host Intrusion Detection System" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Install Python dependencies using 'python -m pip' (avoids pip.exe Application Control blocks)
Write-Host "[*] Verifying and installing Python dependencies..." -ForegroundColor Yellow
python -m pip install -r backend/requirements.txt -q
if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] Warning: Some Python backend dependencies failed to install. Make sure Python is in your PATH." -ForegroundColor Red
} else {
    Write-Host "[+] Backend Python dependencies verified." -ForegroundColor Green
}

python -m pip install -r collector/requirements.txt -q
if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] Warning: Some Python collector dependencies failed to install." -ForegroundColor Red
} else {
    Write-Host "[+] Collector Python dependencies verified." -ForegroundColor Green
}

# 2. Check for .env file and remind the user
if (-not (Test-Path ".env")) {
    Write-Host "[!] WARNING: No .env file found in project root." -ForegroundColor Red
    Write-Host "    Create a .env file with your MONGODB_URI to use MongoDB Atlas." -ForegroundColor Yellow
    Write-Host "    Example: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/hids_db" -ForegroundColor Yellow
    Write-Host "    If no .env is provided, the system will fall back to a local MongoDB or SQLite." -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "[+] .env configuration file found." -ForegroundColor Green
}

# 3. Launch FastAPI Backend
Write-Host "[*] Launching FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"`$Host.UI.RawUI.WindowTitle = 'AI-HIDS Backend Server'; cd backend; python -m uvicorn app.main:app --reload --port 8000`""

# 4. Launch React Frontend
Write-Host "[*] Launching React Dashboard (Vite dev server)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"`$Host.UI.RawUI.WindowTitle = 'AI-HIDS Frontend Dev'; cd frontend; npx vite --port 5173`""

# 5. Launch Windows Telemetry Collector (with threat simulator active)
Write-Host "[*] Launching Windows Telemetry Collector agent (simulation mode active)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"`$Host.UI.RawUI.WindowTitle = 'AI-HIDS Windows Telemetry Agent'; cd collector; python windows_collector.py --simulate`""

Write-Host ""
Write-Host "[+] All services are starting up!" -ForegroundColor Green
Write-Host "    - Dashboard:    http://localhost:5173" -ForegroundColor Cyan
Write-Host "    - Backend API:  http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host "    - WebSocket:    ws://127.0.0.1:8000/ws" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit this launcher..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
