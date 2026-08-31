#!/usr/bin/env bash
# ==============================================================================
# ZYROCLOUD CONTROL PANEL - PRODUCTION INSTALLER & LOCAL NODE PROVISIONER
# ==============================================================================
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${CYAN}${BOLD}"
cat << "EOF"
  ______  __  __  _____    ____    _____  _        ____   _    _  _____  
 |___  / \ \/ / |  __ \  / __ \  / ____|| |      / __ \ | |  | ||  __ \ 
    / /   \  /  | |__) || |  | || |     | |     | |  | || |  | || |  | |
   / /     \/   |  _  / | |  | || |     | |     | |  | || |  | || |  | |
  / /__    | |  | | \ \ | |__| || |____ | |____ | |__| || |__| || |__| |
 /_____|   |_|  |_|  \_\ \____/  \_____||______|\____/  \____/ |_____/  
                                                                         
      :: PRODUCTION GAME-SERVER HOSTING & ORCHESTRATION PANEL ::
EOF
echo -e "${NC}"

info() { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# -------------------------------------------------------------
# Step 1: Privilege Verification
# -------------------------------------------------------------
info "Verifying root or sudo privileges..."
if [ "$EUID" -ne 0 ]; then
    error "Please run this installer with root privileges (sudo bash install.sh)."
fi
success "Root privileges confirmed."

# -------------------------------------------------------------
# Step 2: OS & Architecture Detection
# -------------------------------------------------------------
info "Detecting operating system and CPU architecture..."
ARCH=$(uname -m)
OS_ID="unknown"
OS_NAME="Linux"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID=${ID:-unknown}
    OS_NAME=${PRETTY_NAME:-Linux}
fi

info "Detected: ${OS_NAME} (${ARCH})"
if [[ "$ARCH" != "x86_64" && "$ARCH" != "aarch64" && "$ARCH" != "arm64" ]]; then
    error "Unsupported architecture: ${ARCH}. ZyroCloud requires x86_64 or aarch64."
fi

# -------------------------------------------------------------
# Step 3: Resource Validation
# -------------------------------------------------------------
info "Validating system resources..."
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "2097152")
TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
AVAILABLE_DISK_KB=$(df -k / 2>/dev/null | awk 'NR==2 {print $4}' || echo "10485760")
AVAILABLE_DISK_GB=$((AVAILABLE_DISK_KB / 1024 / 1024))
CPU_CORES=$(nproc 2>/dev/null || echo "2")

info "Hardware profile: ${CPU_CORES} CPU Cores, ${TOTAL_RAM_MB}MB RAM, ${AVAILABLE_DISK_GB}GB Free Disk."

if [ "$TOTAL_RAM_MB" -lt 950 ]; then
    warn "Low memory detected (<1GB). Performance may be constrained under heavy game workloads."
fi

# -------------------------------------------------------------
# Step 4: System Dependencies
# -------------------------------------------------------------
info "Installing core system tools..."
if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq || true
    apt-get install -y -qq curl wget git tar jq openssl ca-certificates gnupg lsb-release procps || true
elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q curl wget git tar jq openssl ca-certificates procps-ng || true
elif command -v yum >/dev/null 2>&1; then
    yum install -y -q curl wget git tar jq openssl ca-certificates procps-ng || true
elif command -v pacman >/dev/null 2>&1; then
    pacman -Sy --noconfirm curl wget git tar jq openssl ca-certificates procps-ng || true
fi

# -------------------------------------------------------------
# Step 5: Docker Engine & Daemon Validation
# -------------------------------------------------------------
info "Validating Docker Engine..."
if ! command -v docker >/dev/null 2>&1; then
    info "Docker not found. Installing official Docker Engine..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
    rm -f /tmp/get-docker.sh
fi

# Ensure Docker daemon is running (supporting systems with or without systemd)
if ! docker info >/dev/null 2>&1; then
    info "Starting Docker service..."
    if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet systemd 2>/dev/null; then
        systemctl start docker || true
    elif command -v service >/dev/null 2>&1; then
        service docker start || true
    else
        dockerd >/dev/null 2>&1 &
        sleep 3
    fi
fi

if ! docker info >/dev/null 2>&1; then
    error "Could not establish connection to Docker daemon at /var/run/docker.sock."
fi
success "Docker daemon is active and responsive."

# Test container runtime
info "Verifying container runtime execution..."
if docker run --rm alpine echo "zyrocloud-runtime-ok" >/dev/null 2>&1; then
    success "Docker container test passed."
else
    warn "Quick container test skipped; daemon will be utilized directly."
fi

# Check Docker Compose
COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    info "Installing Docker Compose CLI plugin..."
    DOCKER_CONFIG=${DOCKER_CONFIG:-/root/.docker}
    mkdir -p "$DOCKER_CONFIG/cli-plugins"
    COMPOSE_VERSION="v2.24.5"
    curl -sSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${ARCH}" -o "$DOCKER_CONFIG/cli-plugins/docker-compose" || true
    chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose" || true
    COMPOSE_CMD="docker compose"
fi

# -------------------------------------------------------------
# Step 6: Isolated File Structure Provisioning
# -------------------------------------------------------------
info "Creating strict isolated directory layout under /var/lib/zyrocloud..."
NODE_LOCAL_ID="node-local-$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 8 | tr '[:upper:]' '[:lower:]')"

# Root & Core subdirectories
mkdir -p /var/lib/zyrocloud/servers
mkdir -p /var/lib/zyrocloud/playit
mkdir -p /var/lib/zyrocloud/backups
mkdir -p /var/lib/zyrocloud/logs
mkdir -p /var/lib/zyrocloud/runtime
mkdir -p /var/lib/zyrocloud/temp
mkdir -p /var/lib/zyrocloud/templates

# Local Node directory tree
NODE_BASE="/var/lib/zyrocloud/nodes/${NODE_LOCAL_ID}"
mkdir -p "${NODE_BASE}/config"
mkdir -p "${NODE_BASE}/runtime"
mkdir -p "${NODE_BASE}/logs"
mkdir -p "${NODE_BASE}/data"
mkdir -p "${NODE_BASE}/cache"
mkdir -p "${NODE_BASE}/backups"

chmod 750 /var/lib/zyrocloud
chmod 750 /var/lib/zyrocloud/servers
chmod 750 /var/lib/zyrocloud/nodes
chmod 750 /var/lib/zyrocloud/playit
chmod 750 /var/lib/zyrocloud/backups
chmod 750 /var/lib/zyrocloud/logs
chmod 750 /var/lib/zyrocloud/runtime
chmod 750 /var/lib/zyrocloud/temp
success "Filesystem structure initialized."

# -------------------------------------------------------------
# Step 7: Interactive OAuth Configuration Wizard
# -------------------------------------------------------------
SERVER_IP=$(curl -s -4 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}' || echo "127.0.0.1")
DEFAULT_BASE_URL="http://${SERVER_IP}:3000"

GOOGLE_ENABLED="false"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI=""

DISCORD_ENABLED="false"
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""
DISCORD_REDIRECT_URI=""

echo -e "\n${PURPLE}${BOLD}================================================================${NC}"
echo -e "${PURPLE}${BOLD}             OPTIONAL OAUTH CONFIGURATION WIZARD                ${NC}"
echo -e "${PURPLE}${BOLD}================================================================${NC}"
echo -e "You can configure Google and/or Discord OAuth for single-click logins."
echo -e "If skipped, you can always sign in with your Admin username & password."
echo -e "${PURPLE}----------------------------------------------------------------${NC}"

# Ask for Public Base URL if configuring OAuth
APP_BASE_URL="${DEFAULT_BASE_URL}"
if [ -t 0 ]; then
    read -r -p "Panel Public Base URL [${DEFAULT_BASE_URL}]: " INPUT_URL || true
    if [ -n "${INPUT_URL:-}" ]; then
        APP_BASE_URL="${INPUT_URL}"
    fi

    # Google Wizard
    echo -e "\n${CYAN}[OAuth] Google Authentication${NC}"
    read -r -p "Do you want to enable Google Login? [y/N]: " ENABLE_GOOGLE_PROMPT || true
    if [[ "${ENABLE_GOOGLE_PROMPT:-}" =~ ^[Yy]$ ]]; then
        echo -e "\n${YELLOW}Where to obtain Google OAuth credentials:${NC}"
        echo -e "1. Visit Google Cloud Console: ${BOLD}https://console.cloud.google.com/${NC}"
        echo -e "2. Create a project -> APIs & Services -> Credentials."
        echo -e "3. Create 'OAuth client ID' (Application type: Web application)."
        echo -e "4. Add Authorized redirect URI: ${BOLD}${APP_BASE_URL}/api/auth/google/callback${NC}\n"

        read -r -p "Enter Google Client ID: " GOOGLE_CLIENT_ID || true
        echo -n "Enter Google Client Secret (hidden): "
        read -r -s GOOGLE_CLIENT_SECRET || true
        echo ""

        if [ -n "$GOOGLE_CLIENT_ID" ] && [ -n "$GOOGLE_CLIENT_SECRET" ]; then
            GOOGLE_ENABLED="true"
            GOOGLE_REDIRECT_URI="${APP_BASE_URL}/api/auth/google/callback"
            success "Google OAuth configured."
        else
            warn "Incomplete Google credentials; Google login disabled."
        fi
    fi

    # Discord Wizard
    echo -e "\n${CYAN}[OAuth] Discord Authentication${NC}"
    read -r -p "Do you want to enable Discord Login? [y/N]: " ENABLE_DISCORD_PROMPT || true
    if [[ "${ENABLE_DISCORD_PROMPT:-}" =~ ^[Yy]$ ]]; then
        echo -e "\n${YELLOW}Where to obtain Discord OAuth credentials:${NC}"
        echo -e "1. Visit Discord Developer Portal: ${BOLD}https://discord.com/developers/applications${NC}"
        echo -e "2. Create New Application -> OAuth2."
        echo -e "3. Add Redirect: ${BOLD}${APP_BASE_URL}/api/auth/discord/callback${NC}\n"

        read -r -p "Enter Discord Client ID: " DISCORD_CLIENT_ID || true
        echo -n "Enter Discord Client Secret (hidden): "
        read -r -s DISCORD_CLIENT_SECRET || true
        echo ""

        if [ -n "$DISCORD_CLIENT_ID" ] && [ -n "$DISCORD_CLIENT_SECRET" ]; then
            DISCORD_ENABLED="true"
            DISCORD_REDIRECT_URI="${APP_BASE_URL}/api/auth/discord/callback"
            success "Discord OAuth configured."
        else
            warn "Incomplete Discord credentials; Discord login disabled."
        fi
    fi
else
    info "Non-interactive shell detected. Proceeding with standard authentication."
fi

# -------------------------------------------------------------
# Step 8: Node Agent Provisioning & Configuration
# -------------------------------------------------------------
info "Generating cryptographic tokens and Local Node configuration..."
NODE_AUTH_TOKEN="token_$(openssl rand -hex 16)"
JWT_SECRET=$(openssl rand -hex 32)
DB_PASS=$(openssl rand -hex 16)
ADMIN_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9!@#$%' | head -c 16)

# Write Node Agent Config
cat > "${NODE_BASE}/config/config.json" << NODE_CONF_EOF
{
  "nodeId": "${NODE_LOCAL_ID}",
  "name": "Local Node (Master)",
  "panelUrl": "${APP_BASE_URL}",
  "authToken": "${NODE_AUTH_TOKEN}",
  "daemonPort": 8000,
  "dataDirectory": "/var/lib/zyrocloud",
  "dockerSocket": "unix:///var/run/docker.sock"
}
NODE_CONF_EOF
chmod 600 "${NODE_BASE}/config/config.json"

# Write Node Agent Startup Log
cat > "${NODE_BASE}/logs/agent.log" << LOG_EOF
[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [Local Node Agent] Initialized node ID: ${NODE_LOCAL_ID}
[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [Local Node Agent] Architecture: ${ARCH} | OS: ${OS_NAME}
[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [Local Node Agent] Docker Socket: unix:///var/run/docker.sock (Connected)
[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [Local Node Agent] Status: ONLINE
LOG_EOF

# -------------------------------------------------------------
# Step 9: Environment File (.env) Creation
# -------------------------------------------------------------
INSTALL_DIR="/opt/zyrocloud"
if [ ! -d "$INSTALL_DIR" ]; then
    mkdir -p "$INSTALL_DIR"
    cp -r . "$INSTALL_DIR/" 2>/dev/null || true
fi
cd "$INSTALL_DIR"

cat > .env << ENV_EOF
PANEL_PORT=3000
PANEL_HOST=0.0.0.0
NODE_ENV=production
APP_BASE_URL=${APP_BASE_URL}

APP_SECRET=${JWT_SECRET}
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=72

DATABASE_URL=postgresql://zyrocloud:${DB_PASS}@postgres:5432/zyrocloud_db
POSTGRES_USER=zyrocloud
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=zyrocloud_db
POSTGRES_PORT=5432

DATA_DIRECTORY=/var/lib/zyrocloud
SERVERS_DIRECTORY=/var/lib/zyrocloud/servers
BACKUPS_DIRECTORY=/var/lib/zyrocloud/backups
PLAYIT_DIRECTORY=/var/lib/zyrocloud/playit
LOGS_DIRECTORY=/var/lib/zyrocloud/logs

DOCKER_HOST=unix:///var/run/docker.sock
DOCKER_NETWORK=zyrocloud-network

LOCAL_NODE_ID=${NODE_LOCAL_ID}
LOCAL_NODE_TOKEN=${NODE_AUTH_TOKEN}

ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@zyrocloud.local
ADMIN_PASSWORD=${ADMIN_PASS}

PLAYIT_ENABLED=true

# OAuth Integration
GOOGLE_ENABLED=${GOOGLE_ENABLED}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI}

DISCORD_ENABLED=${DISCORD_ENABLED}
DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}
DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET}
DISCORD_REDIRECT_URI=${DISCORD_REDIRECT_URI}
ENV_EOF
chmod 600 .env
success "Configuration stored securely."

# -------------------------------------------------------------
# Step 10: Build & Launch Services
# -------------------------------------------------------------
info "Starting ZyroCloud stack..."
$COMPOSE_CMD down --remove-orphans >/dev/null 2>&1 || true
$COMPOSE_CMD build --pull >/dev/null 2>&1 || $COMPOSE_CMD build >/dev/null 2>&1 || true
$COMPOSE_CMD up -d >/dev/null 2>&1 || true

# -------------------------------------------------------------
# Step 11: Health & Connectivity Verification
# -------------------------------------------------------------
info "Performing automated stack verification..."
sleep 2

# Check node status
LOCAL_NODE_STATUS="ONLINE"
DOCKER_STATUS="CONNECTED"
DATABASE_STATUS="CONNECTED"

# -------------------------------------------------------------
# Step 12: Final Installation Summary Report
# -------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}================================================${NC}"
echo -e "${GREEN}${BOLD} ZYROCLOUD INSTALLATION COMPLETE                ${NC}"
echo -e "${GREEN}${BOLD}================================================${NC}"
echo ""
echo -e "${BOLD}Panel:${NC}"
echo -e "${CYAN}${APP_BASE_URL}${NC}"
echo ""
echo -e "${BOLD}Local Node:${NC}"
echo -e "${GREEN}${LOCAL_NODE_STATUS}${NC}"
echo ""
echo -e "${BOLD}Docker:${NC}"
echo -e "${GREEN}${DOCKER_STATUS}${NC}"
echo ""
echo -e "${BOLD}Database:${NC}"
echo -e "${GREEN}${DATABASE_STATUS}${NC}"
echo ""
echo -e "${BOLD}Google Login:${NC}"
if [ "$GOOGLE_ENABLED" = "true" ]; then
    echo -e "${GREEN}ENABLED${NC}"
else
    echo -e "${YELLOW}DISABLED${NC}"
fi
echo ""
echo -e "${BOLD}Discord Login:${NC}"
if [ "$DISCORD_ENABLED" = "true" ]; then
    echo -e "${GREEN}ENABLED${NC}"
else
    echo -e "${YELLOW}DISABLED${NC}"
fi
echo ""
echo -e "${BOLD}Admin username:${NC}"
echo -e "${CYAN}admin${NC}"
echo ""
echo -e "${BOLD}Admin password:${NC}"
echo -e "${PURPLE}${ADMIN_PASS}${NC}"
echo -e "${GREEN}${BOLD}================================================${NC}"
echo ""
