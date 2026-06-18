#!/bin/bash

# Function to clean up background processes on exit
cleanup() {
  echo ""
  echo "Stopping all services..."
  # Terminate processes gracefully, then force if needed
  kill $FRONTEND_PID $BACKEND_PID $WORKER_PID 2>/dev/null
  wait $FRONTEND_PID $BACKEND_PID $WORKER_PID 2>/dev/null
  echo "All services stopped cleanly."
  exit 0
}

# Intercept Ctrl+C (SIGINT) and termination (SIGTERM) signals
trap cleanup SIGINT SIGTERM EXIT

echo "============================================="
echo "        Starting HireFit Services...        "
echo "============================================="

# Start backend server
echo "🚀 Starting backend dev server (port 3001)..."
npm run backend:dev &
BACKEND_PID=$!

# Start backend worker
echo "⚙️  Starting backend worker process..."
npm run backend:worker &
WORKER_PID=$!

# Start frontend
echo "💻 Starting frontend dev server..."
npm run dev &
FRONTEND_PID=$!

echo "============================================="
echo "Services are running. Press Ctrl+C to stop."
echo "============================================="

# Keep script running and wait for background processes
wait
