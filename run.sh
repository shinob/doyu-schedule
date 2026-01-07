#!/usr/bin/env bash

# Doyu Schedule Server Startup Script
set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default configuration
DEFAULT_PORT=3001
DEFAULT_ENV_FILE=".env"

# Parse command line arguments
PORT=${PORT:-$DEFAULT_PORT}
ENV_FILE=${ENV_FILE:-$DEFAULT_ENV_FILE}

# Help function
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo "Start the Doyu Schedule Server"
    echo ""
    echo "Options:"
    echo "  -p, --port PORT       Set server port (default: $DEFAULT_PORT)"
    echo "  -e, --env FILE        Set environment file (default: $DEFAULT_ENV_FILE)"
    echo "  -d, --daemon          Run as background daemon"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  PORT                  Server port"
    echo "  ENV_FILE              Environment file path"
    echo ""
    echo "Examples:"
    echo "  $0                    # Start on default port $DEFAULT_PORT"
    echo "  $0 -p 8080            # Start on port 8080"
    echo "  $0 --daemon           # Start as background daemon"
    echo "  PORT=8080 $0          # Start using environment variable"
}

# Parse arguments
DAEMON_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -e|--env)
            ENV_FILE="$2"
            shift 2
            ;;
        -d|--daemon)
            DAEMON_MODE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Run this script from the project root."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Warning: Environment file '$ENV_FILE' not found"
    if [ -f ".env.example" ]; then
        echo "Creating $ENV_FILE from .env.example..."
        cp .env.example "$ENV_FILE"
        echo "Please edit $ENV_FILE with your configuration"
    fi
fi

# Start the server
echo "Starting Doyu Schedule Server..."
echo "Port: $PORT"
echo "Environment file: $ENV_FILE"

if [ "$DAEMON_MODE" = true ]; then
    echo "Running in daemon mode..."
    nohup env PORT="$PORT" node src/app.js > doyu-schedule.log 2>&1 &
    echo $! > doyu-schedule.pid
    echo "Server started with PID: $(cat doyu-schedule.pid)"
    echo "Log file: doyu-schedule.log"
    echo "To stop: kill \$(cat doyu-schedule.pid)"
else
    env PORT="$PORT" node src/app.js
fi