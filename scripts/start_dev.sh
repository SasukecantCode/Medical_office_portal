#!/bin/bash

# Enable job control so that background tasks get their own process group
set -m

# Configuration


echo "Starting development environment..."
echo "===================================="



echo "===================================="

# 2. Start Backend
echo "Starting backend server..."
fuser -k 8000/tcp 2>/dev/null || true
(cd backend && source ../.venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

# 3. Start Frontend
echo "Starting frontend dev server..."
fuser -k 3000/tcp 2>/dev/null || true
(cd frontend && npm run dev) &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

echo "===================================="
echo "🚀 Development environment ready!"
echo "Press Ctrl+C to stop all services."

# Function to handle shutdown cleanly
cleanup() {
    echo ""
    echo "===================================="
    echo "🛑 Stopping development services..."
    
    if [ -n "$FRONTEND_PID" ]; then
        echo "Stopping frontend (Process Group: -$FRONTEND_PID)..."
        kill -TERM -- -$FRONTEND_PID 2>/dev/null
    fi
    
    if [ -n "$BACKEND_PID" ]; then
        echo "Stopping backend (Process Group: -$BACKEND_PID)..."
        kill -TERM -- -$BACKEND_PID 2>/dev/null
    fi
    
    # Ensure ports are freed
    fuser -k 3000/tcp 2>/dev/null || true
    fuser -k 8000/tcp 2>/dev/null || true
    

    
    echo "✅ Development environment stopped cleanly."
    echo "===================================="
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Wait for background processes
wait $BACKEND_PID $FRONTEND_PID
