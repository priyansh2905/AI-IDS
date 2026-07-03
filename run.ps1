# AI-HIDS Launcher Script
# Starts all services in separate PowerShell windows:
#   1. FastAPI Analytics Backend  (port 8001)
#   2. Express.js Main Server     (port 8000)
#   3. React Vite Frontend        (port 5173)
#   4. HIDS Telemetry Agent       (simulate mode)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  AI-Powered Host Intrusion Detection System " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Python Backend Dependencies -------------------------------------------
Write-Host "[*] Verifying Python dependencies (backend)..." -ForegroundColor Yellow
python -m pip install -r backend/requirements.txt -q
if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] Warning: Some Python dependencies failed to install." -ForegroundColor Red
} else {
    Write-Host "[+] Python dependencies OK." -ForegroundColor Green
}

# --- 2. Node.js Dependencies (main_server) ------------------------------------
Write-Host "[*] Verifying Node.js main_server dependencies..." -ForegroundColor Yellow
Push-Location main_server
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] Warning: main_server npm install failed. Make sure Node.js is in your PATH." -ForegroundColor Red
} else {
    Write-Host "[+] main_server Node.js dependencies OK." -ForegroundColor Green
}
Pop-Location

# --- 3. Node.js Dependencies (frontend) ---------------------------------------
Write-Host "[*] Verifying Node.js frontend dependencies..." -ForegroundColor Yellow
Push-Location frontend
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] Warning: frontend npm install failed." -ForegroundColor Red
} else {
    Write-Host "[+] frontend Node.js dependencies OK." -ForegroundColor Green
}
Pop-Location

Write-Host ""

# --- 4. Check .env ------------------------------------------------------------
if (-not (Test-Path ".env")) {
    Write-Host "[!] WARNING: No .env file found in project root." -ForegroundColor Red
    Write-Host "    Create a .env with MONGODB_URI, EXPRESS_PORT, and FASTAPI_URL." -ForegroundColor Yellow
    Write-Host "    Example: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/hids_db" -ForegroundColor Yellow
} else {
    Write-Host "[+] .env configuration file found." -ForegroundColor Green
}

Write-Host ""

# Capture project root once so subshells get the correct absolute path
$ProjectRoot = $PWD.Path

# --- 5. Launch FastAPI Analytics Backend (port 8001) --------------------------
Write-Host "[*] Launching FastAPI Analytics Backend on http://127.0.0.1:8001..." -ForegroundColor Yellow
$fastapiCmd = "Set-Location '$ProjectRoot\backend'; `$Host.UI.RawUI.WindowTitle = 'AI-HIDS FastAPI Backend'; python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $fastapiCmd
Start-Sleep -Seconds 2

# --- 6. Launch Express.js Main Server (port 8000) -----------------------------
Write-Host "[*] Launching Express.js Main Server on http://127.0.0.1:8000..." -ForegroundColor Yellow
$expressCmd = "Set-Location '$ProjectRoot\main_server'; `$Host.UI.RawUI.WindowTitle = 'AI-HIDS Express Server'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $expressCmd
Start-Sleep -Seconds 2

# --- 7. Launch React Frontend (port 5173) -------------------------------------
Write-Host "[*] Launching React Dashboard (Vite) on http://localhost:5173..." -ForegroundColor Yellow
$frontendCmd = "Set-Location '$ProjectRoot\frontend'; `$Host.UI.RawUI.WindowTitle = 'AI-HIDS Frontend'; npx vite --port 5173"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd
Start-Sleep -Seconds 2

# --- 8. Launch HIDS Agent (simulation mode) -----------------------------------
Write-Host "[*] Launching HIDS Telemetry Agent (simulate mode)..." -ForegroundColor Yellow
$agentCmd = "Set-Location '$ProjectRoot\backend'; `$Host.UI.RawUI.WindowTitle = 'AI-HIDS Agent'; python agent.py --simulate --backend http://127.0.0.1:8001"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $agentCmd

# --- Summary ------------------------------------------------------------------
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "[+] All services are starting up!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Service            URL" -ForegroundColor White
Write-Host "  React Dashboard -> http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Express API     -> http://127.0.0.1:8000/api/health" -ForegroundColor Cyan
Write-Host "  Express WS      -> ws://127.0.0.1:8000/ws" -ForegroundColor Cyan
Write-Host "  FastAPI Docs    -> http://127.0.0.1:8001/docs" -ForegroundColor Cyan
Write-Host "  MongoDB         -> mongodb://localhost:27017/hids_db" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Data Flow: HIDS Agent -> FastAPI (8001) -> Express (8000) -> Frontend (5173)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Press any key to close this launcher window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
