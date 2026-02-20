# Kill all Node.js processes on port 5000

Write-Host "🔍 Finding all processes on port 5000..." -ForegroundColor Cyan

$processes = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | 
    Select-Object -ExpandProperty OwningProcess -Unique

if ($processes) {
    Write-Host "Found $($processes.Count) process(es) on port 5000:" -ForegroundColor Yellow
    foreach ($pid in $processes) {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "  - PID $pid ($($proc.ProcessName))" -ForegroundColor Yellow
        }
    }
    
    Write-Host "`nKilling all processes..." -ForegroundColor Red
    foreach ($pid in $processes) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "  ✅ Killed PID $pid" -ForegroundColor Green
        } catch {
            Write-Host "  ❌ Failed to kill PID $pid" -ForegroundColor Red
        }
    }
    
    Start-Sleep -Seconds 2
    Write-Host "`n✅ All processes killed" -ForegroundColor Green
} else {
    Write-Host "No processes found on port 5000" -ForegroundColor Green
}

Write-Host "`n📊 Current port status:" -ForegroundColor Cyan
$remaining = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "⚠️  Port 5000 still in use!" -ForegroundColor Yellow
} else {
    Write-Host "✅ Port 5000 is now free" -ForegroundColor Green
}
