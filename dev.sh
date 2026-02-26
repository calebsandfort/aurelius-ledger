#!/usr/bin/env bash
set -e

SESSION="aurelius-ledger"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start only the database
echo "Starting database..."
docker compose up -d db

# If already in a tmux session, warn and exit
if [ -n "$TMUX" ]; then
  echo "Already inside a tmux session. Run this outside of tmux."
  exit 1
fi

# Kill existing session if it exists
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Create new detached session, start in project root
tmux new-session -d -s "$SESSION" -c "$ROOT"

# Left pane: backend
tmux send-keys -t "$SESSION" "cd backend && uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload" Enter

# Split vertically (side by side), start in project root
tmux split-window -h -t "$SESSION" -c "$ROOT"

# Right pane: frontend
tmux send-keys -t "$SESSION" "cd frontend && pnpm dev" Enter

# Focus left pane (backend)
tmux select-pane -t "$SESSION:0.0"

# Attach
tmux attach-session -t "$SESSION"
