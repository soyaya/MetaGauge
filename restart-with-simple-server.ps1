# Kill the hung server and start simplified version

Write-Host "🔍 Finding Node.js process on port 5000..." -ForegroundColor Cyan

# Find process on port 5000
$process = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess

if ($process) {
    Write-Host "Found process $process on port 5000" -ForegroundColor Yellow
    Write-Host "Killing process..." -ForegroundColor Yellow
    Stop-Process -Id $process -Force
    Write-Host "✅ Process killed" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "No process found on port 5000" -ForegroundColor Yellow
}

Write-Host "`n🚀 Starting simplified server on port 5002..." -ForegroundColor Cyan
Write-Host "This server does NOT include the streaming indexer" -ForegroundColor Yellow
Write-Host "`nPress Ctrl+C to stop the server`n" -ForegroundColor Gray

node server-no-indexer.js
