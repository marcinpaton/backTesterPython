#!/bin/bash

# Script to manage backend and frontend services on Linux
# Usage: ./manage_services.sh [start|stop|restart]

ACTION="${1:-start}"

# Validate action parameter
if [[ ! "$ACTION" =~ ^(start|stop|restart)$ ]]; then
    echo "Usage: $0 [start|stop|restart]"
    exit 1
fi

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to stop process by port
stop_process_by_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    
    if [ -n "$pids" ]; then
        echo "Stopping process(es) on port $port (PIDs: $pids)..."
        kill -9 $pids 2>/dev/null
        sleep 1
    else
        echo "No process found on port $port."
    fi
}

# Function to start backend
start_backend() {
    echo "Starting Backend..."
    
    # Prepare the activation command for venv
    VENV_ACTIVATE=""
    if [ -d "$SCRIPT_DIR/backend/venv" ]; then
        VENV_ACTIVATE="source '$SCRIPT_DIR/backend/venv/bin/activate' && "
    elif [ -d "$SCRIPT_DIR/venv" ]; then
        VENV_ACTIVATE="source '$SCRIPT_DIR/venv/bin/activate' && "
    fi
    
    # Start backend in a new terminal
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "${VENV_ACTIVATE}cd '$SCRIPT_DIR/backend' && python3 -m uvicorn app.main:app --reload --port 8000; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -e bash -c "${VENV_ACTIVATE}cd '$SCRIPT_DIR/backend' && python3 -m uvicorn app.main:app --reload --port 8000; exec bash" &
    elif command -v konsole &> /dev/null; then
        konsole -e bash -c "${VENV_ACTIVATE}cd '$SCRIPT_DIR/backend' && python3 -m uvicorn app.main:app --reload --port 8000; exec bash" &
    else
        # Fallback: run in background and log to file
        echo "No terminal emulator found. Running backend in background..."
        cd "$SCRIPT_DIR/backend"
        if [ -d "venv" ]; then
            source venv/bin/activate
        elif [ -d "../venv" ]; then
            source ../venv/bin/activate
        fi
        nohup python3 -m uvicorn app.main:app --reload --port 8000 > "$SCRIPT_DIR/backend.log" 2>&1 &
        echo "Backend started in background. Check backend.log for output."
    fi
}

# Function to start frontend
start_frontend() {
    echo "Starting Frontend..."
    cd "$SCRIPT_DIR/frontend"
    
    # Start frontend in a new terminal
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd '$SCRIPT_DIR/frontend' && npm run dev; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -e "cd '$SCRIPT_DIR/frontend' && npm run dev; exec bash" &
    elif command -v konsole &> /dev/null; then
        konsole -e bash -c "cd '$SCRIPT_DIR/frontend' && npm run dev; exec bash" &
    else
        # Fallback: run in background and log to file
        echo "No terminal emulator found. Running frontend in background..."
        nohup npm run dev > "$SCRIPT_DIR/frontend.log" 2>&1 &
        echo "Frontend started in background. Check frontend.log for output."
    fi
}

# Main logic
if [[ "$ACTION" == "stop" ]] || [[ "$ACTION" == "restart" ]]; then
    echo "Stopping services..."
    stop_process_by_port 8000
    stop_process_by_port 5173
fi

if [[ "$ACTION" == "start" ]] || [[ "$ACTION" == "restart" ]]; then
    echo "Starting services..."
    start_backend
    sleep 2  # Give backend time to start
    start_frontend
fi

echo "Done!"
