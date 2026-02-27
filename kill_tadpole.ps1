# kill_tadpole.ps1 - Fast, safe termination for Tadpole OS
# Only kills node/tsx processes on Tadpole ports. Never touches browsers.

$tadpoleNames = @("node", "tsx", "esbuild", "cargo", "rust-backend")

function Stop-TadpoleOnPort($port) {
    Write-Host "Checking port $port..."
    $lines = netstat -ano 2>$null | Select-String "LISTENING" | Select-String ":$port "
    foreach ($line in $lines) {
        $parts = $line.ToString().Trim() -split '\s+'
        $pidVal = [int]$parts[-1]
        if ($pidVal -gt 0) {
            $proc = Get-Process -Id $pidVal -ErrorAction SilentlyContinue
            if ($proc -and ($tadpoleNames -contains $proc.Name.ToLower())) {
                Write-Host "  Killing $($proc.Name) (PID $pidVal) on port $port"
                Stop-Process -Id $pidVal -Force -ErrorAction SilentlyContinue
            }
            elseif ($proc) {
                Write-Host "  Skipping $($proc.Name) (PID $pidVal) - not a Tadpole process"
            }
        }
    }
}

# 1. Kill Tadpole processes on known ports (5174/5175 are Vite fallbacks)
Stop-TadpoleOnPort 8000
Stop-TadpoleOnPort 5173
Stop-TadpoleOnPort 5174
Stop-TadpoleOnPort 5175

# 2. Kill orphan tsx/esbuild (node is too broad for orphan sweep)
foreach ($name in @("tsx", "esbuild")) {
    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
    if ($procs) {
        Write-Host "Killing orphan: $name"
        $procs | Stop-Process -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Done."
