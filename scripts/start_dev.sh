#!/bin/bash

# Enable job control so that background tasks get their own process group
set -m

# Configuration
ONLYOFFICE_CONTAINER="onlyoffice"

echo "Starting development environment..."
echo "===================================="

# 1. Start ONLYOFFICE container (if needed)
echo "Checking ONLYOFFICE container status..."

if docker ps -a --format '{{.Names}}' | grep -Eq "^${ONLYOFFICE_CONTAINER}\$"; then
    # Check if it has the correct JWT_SECRET
    if ! docker inspect --format '{{.Config.Env}}' ${ONLYOFFICE_CONTAINER} | grep -q "JWT_SECRET=S6hGqch18ieb3n5yunIIfC9EuaGMwWM7"; then
        echo "⏳ ONLYOFFICE container exists but has incorrect JWT_SECRET. Recreating..."
        docker rm -f ${ONLYOFFICE_CONTAINER} >/dev/null
    else
        # Container exists and has correct secret, check if it's running
        if [ "$(docker inspect -f '{{.State.Running}}' ${ONLYOFFICE_CONTAINER})" = "true" ]; then
            echo "✅ ONLYOFFICE container is already running."
        else
            echo "⏳ ONLYOFFICE container exists but is stopped. Starting it..."
            docker start ${ONLYOFFICE_CONTAINER} >/dev/null
            if [ $? -eq 0 ]; then
                echo "✅ ONLYOFFICE container started successfully."
            else
                echo "❌ Failed to start ONLYOFFICE container."
                exit 1
            fi
        fi
    fi
fi

if ! docker ps -a --format '{{.Names}}' | grep -Eq "^${ONLYOFFICE_CONTAINER}\$"; then
    echo "⏳ ONLYOFFICE container '${ONLYOFFICE_CONTAINER}' does not exist."
    echo "Creating and starting ONLYOFFICE container..."
    # The JWT_SECRET must match the one in backend/.env
    docker run -i -t -d -p 8080:80 \
        --name ${ONLYOFFICE_CONTAINER} \
        --add-host=host.docker.internal:host-gateway \
        -e JWT_SECRET=S6hGqch18ieb3n5yunIIfC9EuaGMwWM7 \
        -e JWT_ENABLED=true \
        onlyoffice/documentserver >/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ ONLYOFFICE container created and started successfully."
    else
        echo "❌ Failed to create ONLYOFFICE container."
        exit 1
    fi
fi

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
    
    echo "Stopping ONLYOFFICE container..."
    docker stop ${ONLYOFFICE_CONTAINER} >/dev/null 2>&1
    
    echo "✅ Development environment stopped cleanly."
    echo "===================================="
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Wait for background processes
wait $BACKEND_PID $FRONTEND_PID
