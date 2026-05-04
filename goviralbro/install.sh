#!/usr/bin/env bash
# Go Viral Bitch — One-line installer
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/charlesdove977/goviralbitch/main/install.sh)

set -euo pipefail

BLUE='\033[1;34m'
CYAN='\033[1;36m'
WHITE='\033[1;37m'
GREEN='\033[1;32m'
DIM='\033[2m'
RESET='\033[0m'

show_logo() {
    echo ""
    echo -e "${BLUE}    ██████╗ ██╗   ██╗██████╗ ${RESET}"
    echo -e "${BLUE}   ██╔════╝ ██║   ██║██╔══██╗${RESET}"
    echo -e "${BLUE}   ██║  ███╗██║   ██║██████╔╝${RESET}"
    echo -e "${BLUE}   ██║   ██║╚██╗ ██╔╝██╔══██╗${RESET}"
    echo -e "${BLUE}   ╚██████╔╝ ╚████╔╝ ██████╔╝${RESET}"
    echo -e "${BLUE}    ╚═════╝   ╚═══╝  ╚═════╝ ${RESET}"
    echo ""
    echo -e "${WHITE}   Go Viral Bitch${RESET} ${DIM}v0.1.0${RESET}"
    echo -e "${DIM}   Trainable social media coaching system${RESET}"
    echo -e "${DIM}   for Claude Code.${RESET}"
    echo ""
}

show_logo

# Check for git
if ! command -v git &> /dev/null; then
    echo -e "${BLUE}✗${RESET} git not found. Install git first."
    exit 1
fi

# Check for Claude Code
if ! command -v claude &> /dev/null; then
    echo -e "${BLUE}!${RESET} Claude Code CLI not detected. You'll need it to run commands."
    echo -e "${DIM}  Install: https://docs.anthropic.com/en/docs/claude-code${RESET}"
    echo ""
fi

# Clone
INSTALL_DIR="goviralbitch"
if [[ -d "$INSTALL_DIR" ]]; then
    echo -e "${BLUE}!${RESET} Directory '$INSTALL_DIR' already exists."
    echo -e "${DIM}  cd $INSTALL_DIR && bash scripts/init-viral-command.sh${RESET}"
    exit 1
fi

echo -e "${BLUE}↓${RESET} Cloning repository..."
git clone --depth 1 https://github.com/charlesdove977/goviralbitch.git "$INSTALL_DIR" 2>/dev/null
echo -e "${GREEN}✓${RESET} Cloned goviralbitch"

cd "$INSTALL_DIR"

# Run bootstrap
echo -e "${BLUE}↓${RESET} Running bootstrap..."
bash scripts/init-viral-command.sh 2>/dev/null || true
echo -e "${GREEN}✓${RESET} Initialized Viral Command"

# Setup env
if [[ ! -f .env ]] && [[ -f .env.example ]]; then
    cp .env.example .env
    echo -e "${GREEN}✓${RESET} Created .env from template"
fi

echo ""
echo -e "${GREEN}Done!${RESET} Run ${CYAN}/viral:setup${RESET} to get started."
echo ""
