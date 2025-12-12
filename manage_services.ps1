param (
    [ValidateSet("start", "stop", "restart")]
    [string]$Action = "start"
)

function Stop-ProcessByPort {
    param([int]$Port)
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $processId = $conn.OwningProcess
            if ($processId) {
                Write-Host "Stopping process on port $Port (PID: $processId)..."
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            }
        }
    }
    else {
        Write-Host "No process found on port $Port."
    }
}

function Start-Backend {
    Write-Host "Starting Backend..."
    
    # Set default optimization results directory if not set
    if (-not $env:OPTIMIZATION_RESULTS_DIR) {
        $env:OPTIMIZATION_RESULTS_DIR = "C:\pliki_marcina\projects\investment_backtester\optimization_results"
    }
    Write-Host "Optimization Results Dir: $env:OPTIMIZATION_RESULTS_DIR"

    # Opens a new command window for the backend
    Start-Process -FilePath "cmd" -ArgumentList "/k cd backend && python -m uvicorn app.main:app --reload --port 8000" -WorkingDirectory $PSScriptRoot
}

function Start-Frontend {
    Write-Host "Starting Frontend..."
    # Opens a new command window for the frontend
    Start-Process -FilePath "cmd" -ArgumentList "/k cd frontend && npm run dev" -WorkingDirectory $PSScriptRoot
}

# Main logic
if ($Action -eq "stop" -or $Action -eq "restart") {
    Write-Host "Stopping services..."
    Stop-ProcessByPort -Port 8000
    Stop-ProcessByPort -Port 5173
}

if ($Action -eq "start" -or $Action -eq "restart") {
    Write-Host "Starting services..."
    Start-Backend
    Start-Frontend
}
