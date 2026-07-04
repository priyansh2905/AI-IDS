# AI-HIDS Dependency Verification & Installer Script
# Verifies system requirements and installs necessary packages for backend, main_server, and frontend.

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "     AI-HIDS System Installer & Verifier     " -ForegroundColor Cyan
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
Write-Host "=============================================" -ForegroundColor Green
Write-Host "[+] Dependency verification complete!        " -ForegroundColor Green
Write-Host "    Run run.ps1 to start the system.         " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
