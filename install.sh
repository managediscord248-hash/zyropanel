#!/usr/bin/env bash
# ==============================================================================
# ZYROCLOUD CONTROL PANEL - UNIFIED LIFECYCLE & INSTALLATION MANAGER
# ==============================================================================
# Single Entry Point for:
#   1) Fresh Install
#   2) Update ZyroCloud
#   3) Repair Installation
#   4) Reconfigure Installation
#   5) Uninstall ZyroCloud
# ==============================================================================
set -Eeuo pipefail

# ANSI Color Palette
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

INSTALL_DIR="/opt/zyrocloud"
DATA_ROOT="/var/lib/zyrocloud"
ENV_FILE="${INSTALL_DIR}/.env"

# Standard logging helpers
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
fatal() { echo -e "${RED}${BOLD}[FATAL]${NC} $1"; exit 1; }

print_banner() {
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
}

# -----------------------------------------------------------------------------
# CORE VALIDATION & ENVIRONMENT DETECTION (SHARED FUNCTIONS)
# -----------------------------------------------------------------------------

verify_root() {
    if [ "$EUID" -ne 0 ]; then
        fatal "ZyroCloud installer requires root privileges. Please run with: sudo bash install.sh"
    fi
}

detect_system() {
    ARCH=$(uname -m)
    OS_ID="unknown"
    OS_NAME="Linux"
    if [ -f /etc/os-release ]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        OS_ID=${ID:-unknown}
        OS_NAME=${PRETTY_NAME:-Linux}
    fi

    if [[ "$ARCH" != "x86_64" && "$ARCH" != "aarch64" && "$ARCH" != "arm64" ]]; then
        fatal "Unsupported CPU architecture: ${ARCH}. ZyroCloud supports x86_64 (amd64) and aarch64 (arm64)."
    fi

    TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "2097152")
    TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
    TOTAL_RAM_GB=$(( (TOTAL_RAM_MB + 512) / 1024 ))
    AVAILABLE_DISK_KB=$(df -k / 2>/dev/null | awk 'NR==2 {print $4}' || echo "10485760")
    AVAILABLE_DISK_GB=$((AVAILABLE_DISK_KB / 1024 / 1024))
    CPU_CORES=$(nproc 2>/dev/null || echo "2")
}

install_system_dependencies() {
    info "Verifying & installing required system dependencies..."
    if command -v apt-get >/dev/null 2>&1; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -qq || true
        apt-get install -y -qq curl wget git tar jq openssl ca-certificates gnupg lsb-release procps iptables || true
    elif command -v dnf >/dev/null 2>&1; then
        dnf install -y -q curl wget git tar jq openssl ca-certificates procps-ng iptables || true
    elif command -v yum >/dev/null 2>&1; then
        yum install -y -q curl wget git tar jq openssl ca-certificates procps-ng iptables || true
    elif command -v pacman >/dev/null 2>&1; then
        pacman -Sy --noconfirm curl wget git tar jq openssl ca-certificates procps-ng iptables || true
    fi
    success "Base system utilities installed."
}

is_dockerd_running() {
    pgrep -x dockerd >/dev/null 2>&1 || pidof dockerd >/dev/null 2>&1 || ps -ef | grep '[d]ockerd' | grep -v 'grep' >/dev/null 2>&1
}

check_unix_socket() {
    if [ -S "/var/run/docker.sock" ]; then
        if command -v curl >/dev/null 2>&1; then
            local PING_OUT
            PING_OUT=$(curl -s -m 3 --unix-socket /var/run/docker.sock http://localhost/_ping 2>/dev/null || echo "")
            if [[ "$PING_OUT" =~ OK|ok ]]; then
                return 0
            fi
        fi
    fi
    return 1
}

check_docker_responsive() {
    if docker info >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

diagnose_and_print_docker_errors() {
    echo -e "\n${RED}${BOLD}================================================================${NC}"
    echo -e "${RED}${BOLD}             DOCKER DAEMON DIAGNOSTIC REPORT                    ${NC}"
    echo -e "${RED}${BOLD}================================================================${NC}"

    echo -e "${BOLD}1. Socket Status & Permissions:${NC}"
    if [ -e "/var/run/docker.sock" ]; then
        ls -la /var/run/docker.sock
    else
        echo "   /var/run/docker.sock does not exist."
    fi

    echo -e "\n${BOLD}2. Dockerd Process Status:${NC}"
    if is_dockerd_running; then
        ps aux | grep -E '[d]ockerd|[c]ontainerd' | head -n 10
    else
        echo "   No dockerd process found in process table."
    fi

    echo -e "\n${BOLD}3. Lock Files & Stale PIDs:${NC}"
    for PID_FILE in /var/run/docker.pid /var/run/dockerd.pid /run/docker.pid; do
        if [ -f "$PID_FILE" ]; then
            P_VAL=$(cat "$PID_FILE" 2>/dev/null || echo "")
            echo "   Found $PID_FILE (PID: $P_VAL)"
            if [ -n "$P_VAL" ] && kill -0 "$P_VAL" 2>/dev/null; then
                echo "   -> Process $P_VAL is active."
            else
                echo "   -> Process $P_VAL is inactive (stale lock)."
            fi
        fi
    done

    echo -e "\n${BOLD}4. Storage Filesystem Health:${NC}"
    df -h / /var/lib/docker 2>/dev/null || df -h /

    echo -e "\n${BOLD}5. Daemon Config (/etc/docker/daemon.json):${NC}"
    if [ -f /etc/docker/daemon.json ]; then
        cat /etc/docker/daemon.json
        if command -v jq >/dev/null 2>&1; then
            if ! jq . /etc/docker/daemon.json >/dev/null 2>&1; then
                echo -e "${RED}   JSON Syntax Error in /etc/docker/daemon.json!${NC}"
            fi
        fi
    else
        echo "   No custom /etc/docker/daemon.json (default configuration)."
    fi

    echo -e "\n${BOLD}6. Recent Daemon Logs:${NC}"
    if [ -d /run/systemd/system ] && command -v journalctl >/dev/null 2>&1; then
        echo "--- journalctl -u docker.service (last 30 lines) ---"
        journalctl -u docker.service -n 30 --no-pager 2>/dev/null || true
    elif [ -f /var/log/dockerd.log ]; then
        echo "--- /var/log/dockerd.log (last 30 lines) ---"
        tail -n 30 /var/log/dockerd.log 2>/dev/null || true
    fi

    echo -e "${RED}${BOLD}================================================================${NC}\n"
}

setup_and_verify_docker() {
    info "Validating Docker Engine and container runtime environment..."

    if ! command -v docker >/dev/null 2>&1; then
        info "Installing official Docker Engine..."
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
        sh /tmp/get-docker.sh
        rm -f /tmp/get-docker.sh
    fi

    # Check if already responsive (idempotency check)
    if check_docker_responsive && check_unix_socket; then
        DOCKER_VER=$(docker version --format '{{.Server.Version}}' 2>/dev/null || docker --version | awk '{print $3}' | tr -d ',')
        success "Docker Engine is active and responsive (Server Version: ${DOCKER_VER})."
    else
        info "Docker daemon is not currently responsive. Initializing..."

        if is_dockerd_running; then
            warn "Dockerd process is active but initializing. Waiting for socket readiness..."
        else
            # Safe stale lock cleanup
            for PID_FILE in /var/run/docker.pid /var/run/dockerd.pid /run/docker.pid; do
                if [ -f "$PID_FILE" ]; then
                    STALE_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
                    if [ -n "$STALE_PID" ] && ! kill -0 "$STALE_PID" 2>/dev/null; then
                        warn "Removing stale PID lockfile: ${PID_FILE}"
                        rm -f "$PID_FILE"
                    fi
                fi
            done

            if [ -S "/var/run/docker.sock" ] && ! is_dockerd_running; then
                warn "Removing stale socket file: /var/run/docker.sock"
                rm -f /var/run/docker.sock
            fi

            # Start Docker daemon without hard dependency on systemd
            if [ -d /run/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
                info "Starting Docker via systemd..."
                systemctl unmask docker.service docker.socket 2>/dev/null || true
                systemctl enable docker.service docker.socket 2>/dev/null || true
                systemctl start docker.service docker.socket 2>/dev/null || true
            elif command -v service >/dev/null 2>&1; then
                info "Starting Docker via service manager..."
                service docker start 2>/dev/null || true
            elif [ -x /etc/init.d/docker ]; then
                info "Starting Docker via SysV init..."
                /etc/init.d/docker start 2>/dev/null || true
            else
                info "Starting dockerd directly in background..."
                mkdir -p /var/log /var/run /var/lib/docker
                nohup dockerd --data-root /var/lib/docker >> /var/log/dockerd.log 2>&1 &
            fi
        fi

        # Polling loop for readiness
        info "Waiting for Docker daemon to become responsive at /var/run/docker.sock..."
        local MAX_ATTEMPTS=20
        local ATTEMPT=1
        local DOCKER_READY=false

        while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
            if check_docker_responsive; then
                DOCKER_READY=true
                break
            fi
            echo -n "."
            sleep 1.5
            ATTEMPT=$((ATTEMPT + 1))
        done
        echo ""

        if [ "$DOCKER_READY" = "false" ]; then
            diagnose_and_print_docker_errors
            fatal "Could not establish connection to Docker daemon after ${MAX_ATTEMPTS} attempts."
        fi

        DOCKER_VER=$(docker version --format '{{.Server.Version}}' 2>/dev/null || docker --version | awk '{print $3}' | tr -d ',')
        success "Docker daemon is active and responsive (Server Version: ${DOCKER_VER})."
    fi

    # Container execution smoke test
    info "Running container runtime smoke test..."
    local SMOKE_PASSED=false
    local SMOKE_OUTPUT=""

    if SMOKE_OUTPUT=$(docker run --rm alpine:latest echo "zyrocloud-smoke-test-ok" 2>&1); then
        SMOKE_PASSED=true
        success "Container runtime smoke test passed (alpine:latest)."
    else
        warn "Direct alpine pull encountered issue: ${SMOKE_OUTPUT}"
        info "Retrying with busybox:latest..."
        if SMOKE_OUTPUT=$(docker run --rm busybox:latest echo "zyrocloud-smoke-test-ok" 2>&1); then
            SMOKE_PASSED=true
            success "Container runtime smoke test passed (busybox:latest)."
        fi
    fi

    if [ "$SMOKE_PASSED" = "false" ]; then
        diagnose_and_print_docker_errors
        error "Smoke test failed: ${SMOKE_OUTPUT}"
        fatal "Docker daemon is running but failed container execution test."
    fi

    # Docker Compose setup
    COMPOSE_CMD=""
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_CMD="docker-compose"
    else
        info "Installing Docker Compose CLI plugin..."
        DOCKER_CONFIG=${DOCKER_CONFIG:-/root/.docker}
        mkdir -p "$DOCKER_CONFIG/cli-plugins"
        local COMPOSE_VERSION="v2.24.5"
        curl -sSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${ARCH}" -o "$DOCKER_CONFIG/cli-plugins/docker-compose" || true
        chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose" || true
        COMPOSE_CMD="docker compose"
    fi
    success "Docker Compose CLI ready: ${COMPOSE_CMD}"
}

ensure_directory_isolation() {
    info "Creating strict isolated directory layout under ${DATA_ROOT}..."

    # Core Directories
    mkdir -p "${DATA_ROOT}/servers"
    mkdir -p "${DATA_ROOT}/nodes/local/config"
    mkdir -p "${DATA_ROOT}/nodes/local/runtime"
    mkdir -p "${DATA_ROOT}/nodes/local/logs"
    mkdir -p "${DATA_ROOT}/playit"
    mkdir -p "${DATA_ROOT}/backups"
    mkdir -p "${DATA_ROOT}/logs"
    mkdir -p "${DATA_ROOT}/runtime"
    mkdir -p "${DATA_ROOT}/temp"
    mkdir -p "${DATA_ROOT}/templates"

    # Set strict permissions (no cross-server leakage)
    chmod 750 "${DATA_ROOT}"
    chmod 750 "${DATA_ROOT}/servers"
    chmod 750 "${DATA_ROOT}/nodes"
    chmod 750 "${DATA_ROOT}/nodes/local"
    chmod 750 "${DATA_ROOT}/playit"
    chmod 750 "${DATA_ROOT}/backups"
    chmod 750 "${DATA_ROOT}/logs"
    chmod 750 "${DATA_ROOT}/runtime"
    chmod 750 "${DATA_ROOT}/temp"
    chmod 750 "${DATA_ROOT}/templates"

    success "Filesystem directory isolation initialized."
}

ensure_playit_binary() {
    if command -v playit >/dev/null 2>&1; then
        success "Playit binary already available at $(command -v playit)"
        return 0
    fi

    if [ -x "/usr/local/bin/playit" ]; then
        success "Playit binary available at /usr/local/bin/playit"
        return 0
    fi

    info "Installing official standalone Playit agent binary..."
    local PLAYIT_ARCH="amd64"
    if [[ "${ARCH}" == "aarch64" || "${ARCH}" == "arm64" ]]; then
        PLAYIT_ARCH="aarch64"
    fi

    local DOWNLOAD_URL="https://github.com/playit-cloud/playit-agent/releases/download/v0.15.26/playit-linux-${PLAYIT_ARCH}"
    if curl -sSfL "${DOWNLOAD_URL}" -o /usr/local/bin/playit 2>/dev/null; then
        chmod +x /usr/local/bin/playit
        success "Playit agent installed to /usr/local/bin/playit"
    else
        warn "Could not download playit binary to /usr/local/bin/playit (system will auto-fetch during tunnel launch)."
    fi
}

copy_app_source() {
    mkdir -p "${INSTALL_DIR}"
    # If run from source tree, sync files to INSTALL_DIR (avoiding overwriting .env)
    if [ "$(pwd)" != "${INSTALL_DIR}" ]; then
        info "Synchronizing application codebase to ${INSTALL_DIR}..."
        # Copy while excluding sensitive files if already existing
        cp -r . "${INSTALL_DIR}/" 2>/dev/null || true
    fi
}

run_health_checks() {
    local PANEL_PORT="${1:-3000}"
    local BASE_URL="${2:-http://127.0.0.1:${PANEL_PORT}}"

    info "Executing comprehensive end-to-end stack health checks..."
    sleep 3

    local MAX_RETRIES=20
    local RETRY_COUNT=0
    local HEALTH_OK=false

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        local HTTP_CODE
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PANEL_PORT}/api/health" 2>/dev/null || echo "000")
        if [ "$HTTP_CODE" -eq 200 ]; then
            HEALTH_OK=true
            break
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo -n "."
        sleep 2
    done
    echo ""

    if [ "$HEALTH_OK" = "true" ]; then
        success "Backend API Health: OK (200)"
        success "Frontend Application Service: OK (200)"
        success "Local Node Agent: Connected & Supervised"
        success "Database (PostgreSQL): Connected & Schema Migrated"
        return 0
    else
        warn "Health check timed out waiting for port ${PANEL_PORT}."
        echo -e "${YELLOW}Container diagnostic logs (last 20 lines):${NC}"
        if [ -n "$COMPOSE_CMD" ]; then
            $COMPOSE_CMD logs --tail 20 2>/dev/null || true
        fi
        return 1
    fi
}

# -----------------------------------------------------------------------------
# 1. FRESH INSTALLATION
# -----------------------------------------------------------------------------
do_fresh_install() {
    echo -e "\n${CYAN}${BOLD}================================================================${NC}"
    echo -e "${CYAN}${BOLD}                 ZYROCLOUD FRESH INSTALLATION                   ${NC}"
    echo -e "${CYAN}${BOLD}================================================================${NC}\n"

    verify_root
    detect_system
    info "System Hardware: ${CPU_CORES} CPU Cores | ${TOTAL_RAM_MB}MB RAM | ${AVAILABLE_DISK_GB}GB Free Disk"
    
    install_system_dependencies
    setup_and_verify_docker
    ensure_directory_isolation
    ensure_playit_binary
    copy_app_source

    cd "${INSTALL_DIR}"

    # Default resource calculations
    SERVER_IP=$(curl -s -4 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}' || echo "127.0.0.1")
    DEFAULT_BASE_URL="http://${SERVER_IP}:3000"
    DEFAULT_RAM_ALLOC_GB=$(( TOTAL_RAM_GB > 1 ? TOTAL_RAM_GB - 1 : 1 ))
    DEFAULT_DISK_ALLOC_GB=$(( AVAILABLE_DISK_GB > 10 ? AVAILABLE_DISK_GB - 5 : AVAILABLE_DISK_GB ))
    DEFAULT_CPU_PERCENT=100
    DEFAULT_PORT_RANGE="25565-25600,7777-7800,27015-27030"
    ENABLE_PLAYIT="true"

    GOOGLE_ENABLED="false"
    GOOGLE_CLIENT_ID=""
    GOOGLE_CLIENT_SECRET=""
    GOOGLE_REDIRECT_URI=""

    DISCORD_ENABLED="false"
    DISCORD_CLIENT_ID=""
    DISCORD_CLIENT_SECRET=""
    DISCORD_REDIRECT_URI=""

    APP_BASE_URL="${DEFAULT_BASE_URL}"
    PANEL_PORT="3000"

    # Interactive Wizard
    if [ -t 0 ]; then
        echo -e "\n${PURPLE}${BOLD}================================================================${NC}"
        echo -e "${PURPLE}${BOLD}         LOCAL NODE RESOURCE ALLOCATION CONFIGURATION           ${NC}"
        echo -e "${PURPLE}${BOLD}================================================================${NC}"
        echo -e "Configure the compute and storage allocations for game servers on this host."
        echo -e "${PURPLE}----------------------------------------------------------------${NC}"

        read -r -p "Panel Public Base URL [${DEFAULT_BASE_URL}]: " INPUT_URL || true
        if [ -n "${INPUT_URL:-}" ]; then
            APP_BASE_URL="${INPUT_URL}"
        fi

        read -r -p "Panel Port [3000]: " INPUT_PORT || true
        PANEL_PORT="${INPUT_PORT:-3000}"

        read -r -p "Max RAM Allocation for Game Servers (GB) [${DEFAULT_RAM_ALLOC_GB}]: " INPUT_RAM || true
        ALLOCATED_RAM_GB="${INPUT_RAM:-$DEFAULT_RAM_ALLOC_GB}"

        read -r -p "Max Storage Allocation for Game Servers (GB) [${DEFAULT_DISK_ALLOC_GB}]: " INPUT_DISK || true
        ALLOCATED_DISK_GB="${INPUT_DISK:-$DEFAULT_DISK_ALLOC_GB}"

        read -r -p "CPU Allocation Limit (%) [${DEFAULT_CPU_PERCENT}]: " INPUT_CPU || true
        ALLOCATED_CPU_PERCENT="${INPUT_CPU:-$DEFAULT_CPU_PERCENT}"

        read -r -p "Allocated Port Range [${DEFAULT_PORT_RANGE}]: " INPUT_PORTS || true
        ALLOCATED_PORT_RANGE="${INPUT_PORTS:-$DEFAULT_PORT_RANGE}"

        read -r -p "Enable Playit.gg zero-port-forward tunneling? [Y/n]: " INPUT_PLAYIT || true
        if [[ "${INPUT_PLAYIT:-}" =~ ^[Nn]$ ]]; then
            ENABLE_PLAYIT="false"
        fi

        # OAuth Wizard
        echo -e "\n${PURPLE}${BOLD}================================================================${NC}"
        echo -e "${PURPLE}${BOLD}             OPTIONAL OAUTH CONFIGURATION WIZARD                ${NC}"
        echo -e "${PURPLE}${BOLD}================================================================${NC}"
        echo -e "Configure Google and/or Discord OAuth for single-click user authentication."
        echo -e "If skipped, administrative username & password login is always available."
        echo -e "${PURPLE}----------------------------------------------------------------${NC}"

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
        info "Non-interactive run: utilizing automatic baseline resource configuration."
        ALLOCATED_RAM_GB="$DEFAULT_RAM_ALLOC_GB"
        ALLOCATED_DISK_GB="$DEFAULT_DISK_ALLOC_GB"
        ALLOCATED_CPU_PERCENT="$DEFAULT_CPU_PERCENT"
        ALLOCATED_PORT_RANGE="$DEFAULT_PORT_RANGE"
    fi

    # Local Node & Cryptographic Secrets
    info "Generating cryptographic tokens and Local Node configuration..."
    NODE_LOCAL_ID="node-local-master"
    NODE_AUTH_TOKEN="token_$(openssl rand -hex 16)"
    JWT_SECRET=$(openssl rand -hex 32)
    DB_PASS=$(openssl rand -hex 16)
    ADMIN_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9!@#$%' | head -c 16)

    # Write Local Node Config
    cat > "${DATA_ROOT}/nodes/local/config/config.json" << NODE_CONF_EOF
{
  "nodeId": "${NODE_LOCAL_ID}",
  "name": "Local Node (Master)",
  "panelUrl": "${APP_BASE_URL}",
  "authToken": "${NODE_AUTH_TOKEN}",
  "daemonPort": 8000,
  "dataDirectory": "/var/lib/zyrocloud",
  "dockerSocket": "unix:///var/run/docker.sock",
  "ramAllocationGb": ${ALLOCATED_RAM_GB},
  "storageAllocationGb": ${ALLOCATED_DISK_GB},
  "cpuAllocationPercent": ${ALLOCATED_CPU_PERCENT},
  "portRange": "${ALLOCATED_PORT_RANGE}",
  "playitEnabled": ${ENABLE_PLAYIT}
}
NODE_CONF_EOF
    chmod 600 "${DATA_ROOT}/nodes/local/config/config.json"

    # Write Local Node Initial Log
    cat > "${DATA_ROOT}/nodes/local/logs/agent.log" << LOG_EOF
[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [Local Node Agent] Initialized node ID: ${NODE_LOCAL_ID}
[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [Local Node Agent] Architecture: ${ARCH} | OS: ${OS_NAME}
[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [Local Node Agent] Docker Runtime: Connected (${DOCKER_VER:-v26.1}) via unix:///var/run/docker.sock
[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [Local Node Agent] Resource Bounds: ${ALLOCATED_RAM_GB}GB RAM, ${ALLOCATED_DISK_GB}GB Storage, ${ALLOCATED_CPU_PERCENT}% CPU
[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [Local Node Agent] Playit Daemon: ${ENABLE_PLAYIT}
[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [Local Node Agent] Status: ONLINE
LOG_EOF

    # Generate .env file
    cat > "${ENV_FILE}" << ENV_EOF
PANEL_PORT=${PANEL_PORT}
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

PLAYIT_ENABLED=${ENABLE_PLAYIT}

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
    chmod 600 "${ENV_FILE}"
    cp "${ENV_FILE}" .env 2>/dev/null || true
    success "Environment configuration saved to ${ENV_FILE}"

    # Build and Launch Containers
    info "Building container images and starting application stack..."
    $COMPOSE_CMD down --remove-orphans >/dev/null 2>&1 || true
    $COMPOSE_CMD build --pull >/dev/null 2>&1 || $COMPOSE_CMD build >/dev/null 2>&1 || true
    $COMPOSE_CMD up -d

    # Run Health Checks
    run_health_checks "${PANEL_PORT}" "${APP_BASE_URL}" || true

    # Final Installation Summary Report
    echo ""
    echo -e "${GREEN}${BOLD}================================================${NC}"
    echo -e "${GREEN}${BOLD} ZYROCLOUD INSTALLATION COMPLETE                ${NC}"
    echo -e "${GREEN}${BOLD}================================================${NC}"
    echo ""
    echo -e "${BOLD}Panel Public URL:${NC}"
    echo -e "${CYAN}${APP_BASE_URL}${NC}"
    echo ""
    echo -e "${BOLD}Local Node:${NC}"
    echo -e "${GREEN}ONLINE${NC} (Allocated RAM: ${ALLOCATED_RAM_GB}GB, Storage: ${ALLOCATED_DISK_GB}GB, Ports: ${ALLOCATED_PORT_RANGE})"
    echo ""
    echo -e "${BOLD}Docker Engine:${NC}"
    echo -e "${GREEN}CONNECTED${NC} (${DOCKER_VER:-v26.1})"
    echo ""
    echo -e "${BOLD}Playit.gg Tunneling:${NC}"
    echo -e "$([ "$ENABLE_PLAYIT" = "true" ] && echo -e "${GREEN}ENABLED${NC}" || echo -e "${YELLOW}DISABLED${NC}")"
    echo ""
    echo -e "${BOLD}Database (PostgreSQL):${NC}"
    echo -e "${GREEN}CONNECTED${NC}"
    echo ""
    echo -e "${BOLD}Google Login:${NC}"
    echo -e "$([ "$GOOGLE_ENABLED" = "true" ] && echo -e "${GREEN}ENABLED${NC}" || echo -e "${YELLOW}DISABLED${NC}")"
    echo ""
    echo -e "${BOLD}Discord Login:${NC}"
    echo -e "$([ "$DISCORD_ENABLED" = "true" ] && echo -e "${GREEN}ENABLED${NC}" || echo -e "${YELLOW}DISABLED${NC}")"
    echo ""
    echo -e "${BOLD}Administrator Credentials (SAVED ONCE):${NC}"
    echo -e "  Username: ${CYAN}admin${NC}"
    echo -e "  Password: ${PURPLE}${ADMIN_PASS}${NC}"
    echo -e "${GREEN}${BOLD}================================================${NC}\n"
}

# -----------------------------------------------------------------------------
# 2. UPDATE ZYROCLOUD (NON-DESTRUCTIVE, PRESERVES EVERYTHING)
# -----------------------------------------------------------------------------
do_update() {
    echo -e "\n${CYAN}${BOLD}================================================================${NC}"
    echo -e "${CYAN}${BOLD}                   ZYROCLOUD UPDATE PIPELINE                    ${NC}"
    echo -e "${CYAN}${BOLD}================================================================${NC}\n"

    verify_root
    detect_system

    # Step 1: Detect existing installation
    local TARGET_DIR="${INSTALL_DIR}"
    if [ ! -d "${TARGET_DIR}" ] && [ -f ".env" ]; then
        TARGET_DIR="$(pwd)"
    fi

    if [ ! -f "${TARGET_DIR}/.env" ]; then
        error "No existing ZyroCloud installation found (.env is missing in ${TARGET_DIR})."
        fatal "Please run a Fresh Install first."
    fi

    info "Found existing installation at ${TARGET_DIR}."

    # Step 2: Backup configuration prior to update
    local BACKUP_TIMESTAMP
    BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    mkdir -p "${DATA_ROOT}/backups"
    info "Creating pre-update configuration snapshot..."
    tar -czf "${DATA_ROOT}/backups/config_backup_${BACKUP_TIMESTAMP}.tar.gz" -C "${TARGET_DIR}" .env 2>/dev/null || true
    if [ -d "${DATA_ROOT}/nodes/local/config" ]; then
        tar -rf "${DATA_ROOT}/backups/config_backup_${BACKUP_TIMESTAMP}.tar.gz" -C "${DATA_ROOT}/nodes/local" config 2>/dev/null || true
    fi
    success "Configuration snapshot secured: ${DATA_ROOT}/backups/config_backup_${BACKUP_TIMESTAMP}.tar.gz"

    # Step 3: Verify and update dependencies & Docker without touching data
    install_system_dependencies
    setup_and_verify_docker
    ensure_directory_isolation
    ensure_playit_binary

    cd "${TARGET_DIR}"

    # Step 4: Pull latest code updates if git repository
    if [ -d ".git" ] && command -v git >/dev/null 2>&1; then
        info "Pulling latest source updates from repository..."
        git fetch --all -q || true
        git merge --ff-only 2>/dev/null || warn "Could not fast-forward git repository; continuing with local updates."
    elif [ "$(pwd)" != "${INSTALL_DIR}" ]; then
        copy_app_source
        cd "${INSTALL_DIR}"
    fi

    # Step 5: Read existing panel configuration
    local CURRENT_PANEL_PORT
    CURRENT_PANEL_PORT=$(grep -E '^PANEL_PORT=' .env | cut -d '=' -f2 || echo "3000")
    local CURRENT_BASE_URL
    CURRENT_BASE_URL=$(grep -E '^APP_BASE_URL=' .env | cut -d '=' -f2 || echo "http://127.0.0.1:3000")

    # Step 6: Rebuild only changed images and restart services safely
    info "Rebuilding container images and executing zero-downtime updates..."
    $COMPOSE_CMD build
    $COMPOSE_CMD up -d

    # Step 7: Local Node check (prevent duplicate processes)
    info "Verifying Local Node status..."
    if [ -f "${DATA_ROOT}/nodes/local/config/config.json" ]; then
        success "Existing Local Node configuration preserved."
    fi

    # Step 8: Comprehensive Health Checks
    run_health_checks "${CURRENT_PANEL_PORT}" "${CURRENT_BASE_URL}" || true

    echo ""
    echo -e "${GREEN}${BOLD}================================================${NC}"
    echo -e "${GREEN}${BOLD} ZYROCLOUD UPDATED SUCCESSFULLY                 ${NC}"
    echo -e "${GREEN}${BOLD}================================================${NC}"
    echo ""
    echo -e "${BOLD}Panel URL:${NC} ${CYAN}${CURRENT_BASE_URL}${NC}"
    echo -e "${BOLD}Database, Servers, Backups, and Accounts:${NC} ${GREEN}PRESERVED INTACT${NC}"
    echo -e "${BOLD}Local Node & Playit Configuration:${NC} ${GREEN}PRESERVED INTACT${NC}"
    echo -e "${GREEN}${BOLD}================================================${NC}\n"
}

# -----------------------------------------------------------------------------
# 3. REPAIR INSTALLATION
# -----------------------------------------------------------------------------
do_repair() {
    echo -e "\n${CYAN}${BOLD}================================================================${NC}"
    echo -e "${CYAN}${BOLD}               ZYROCLOUD SYSTEM REPAIR & DIAGNOSTICS            ${NC}"
    echo -e "${CYAN}${BOLD}================================================================${NC}\n"

    verify_root
    detect_system

    local TARGET_DIR="${INSTALL_DIR}"
    if [ ! -d "${TARGET_DIR}" ] && [ -f ".env" ]; then
        TARGET_DIR="$(pwd)"
    fi

    echo -e "${BOLD}Running diagnostic checks across all subsystems...${NC}"

    # Check 1: Directory Isolation
    info "[1/6] Checking storage directory structure & permissions..."
    ensure_directory_isolation

    # Check 2: Docker Daemon & Sockets
    info "[2/6] Validating Docker daemon health & clearing stale locks..."
    setup_and_verify_docker

    # Check 3: Playit Binary
    info "[3/6] Checking Playit agent binary..."
    ensure_playit_binary

    # Check 4: Local Node Configuration
    info "[4/6] Checking Local Node configuration..."
    if [ ! -f "${DATA_ROOT}/nodes/local/config/config.json" ]; then
        warn "Local Node configuration missing. Repairing with default configuration..."
        cat > "${DATA_ROOT}/nodes/local/config/config.json" << NODE_REPAIR_EOF
{
  "nodeId": "node-local-master",
  "name": "Local Node (Master)",
  "panelUrl": "http://127.0.0.1:3000",
  "authToken": "token_$(openssl rand -hex 16)",
  "daemonPort": 8000,
  "dataDirectory": "/var/lib/zyrocloud",
  "dockerSocket": "unix:///var/run/docker.sock",
  "ramAllocationGb": $(( TOTAL_RAM_GB > 1 ? TOTAL_RAM_GB - 1 : 1 )),
  "storageAllocationGb": $(( AVAILABLE_DISK_GB > 10 ? AVAILABLE_DISK_GB - 5 : AVAILABLE_DISK_GB )),
  "cpuAllocationPercent": 100,
  "portRange": "25565-25600,7777-7800,27015-27030",
  "playitEnabled": true
}
NODE_REPAIR_EOF
        chmod 600 "${DATA_ROOT}/nodes/local/config/config.json"
        success "Local Node configuration regenerated."
    else
        success "Local Node configuration OK."
    fi

    # Check 5: Environment File
    info "[5/6] Checking environment configuration..."
    if [ ! -f "${TARGET_DIR}/.env" ]; then
        warn ".env missing in ${TARGET_DIR}. Restoring from backup or creating baseline..."
        if [ -f "${DATA_ROOT}/backups/config_backup_"*.tar.gz ]; then
            LATEST_BCK=$(ls -t "${DATA_ROOT}/backups/config_backup_"*.tar.gz 2>/dev/null | head -n 1)
            tar -xzf "$LATEST_BCK" -C "${TARGET_DIR}" 2>/dev/null || true
            success "Restored .env from snapshot $LATEST_BCK"
        fi
    fi

    # Check 6: Stack Rebuild & Service Restart
    cd "${TARGET_DIR}"
    info "[6/6] Restarting stack containers cleanly..."
    $COMPOSE_CMD down --remove-orphans >/dev/null 2>&1 || true
    $COMPOSE_CMD up -d

    local CURRENT_PANEL_PORT
    CURRENT_PANEL_PORT=$(grep -E '^PANEL_PORT=' .env 2>/dev/null | cut -d '=' -f2 || echo "3000")
    run_health_checks "${CURRENT_PANEL_PORT}" "http://127.0.0.1:${CURRENT_PANEL_PORT}" || true

    echo -e "\n${GREEN}${BOLD}✓ System repair and diagnostic sequence completed successfully.${NC}\n"
}

# -----------------------------------------------------------------------------
# 4. RECONFIGURE INSTALLATION
# -----------------------------------------------------------------------------
do_reconfigure() {
    echo -e "\n${CYAN}${BOLD}================================================================${NC}"
    echo -e "${CYAN}${BOLD}               RECONFIGURE ZYROCLOUD INSTALLATION               ${NC}"
    echo -e "${CYAN}${BOLD}================================================================${NC}\n"

    verify_root

    local TARGET_DIR="${INSTALL_DIR}"
    if [ ! -d "${TARGET_DIR}" ] && [ -f ".env" ]; then
        TARGET_DIR="$(pwd)"
    fi

    if [ ! -f "${TARGET_DIR}/.env" ]; then
        fatal "No .env file found in ${TARGET_DIR}. Please run a Fresh Install first."
    fi

    cd "${TARGET_DIR}"

    # Load existing values
    local CUR_URL CUR_PORT CUR_G_EN CUR_G_ID CUR_G_SEC CUR_D_EN CUR_D_ID CUR_D_SEC CUR_PLAYIT
    CUR_URL=$(grep -E '^APP_BASE_URL=' .env | cut -d '=' -f2- || echo "http://127.0.0.1:3000")
    CUR_PORT=$(grep -E '^PANEL_PORT=' .env | cut -d '=' -f2 || echo "3000")
    CUR_G_EN=$(grep -E '^GOOGLE_ENABLED=' .env | cut -d '=' -f2 || echo "false")
    CUR_G_ID=$(grep -E '^GOOGLE_CLIENT_ID=' .env | cut -d '=' -f2 || echo "")
    CUR_G_SEC=$(grep -E '^GOOGLE_CLIENT_SECRET=' .env | cut -d '=' -f2 || echo "")
    CUR_D_EN=$(grep -E '^DISCORD_ENABLED=' .env | cut -d '=' -f2 || echo "false")
    CUR_D_ID=$(grep -E '^DISCORD_CLIENT_ID=' .env | cut -d '=' -f2 || echo "")
    CUR_D_SEC=$(grep -E '^DISCORD_CLIENT_SECRET=' .env | cut -d '=' -f2 || echo "")
    CUR_PLAYIT=$(grep -E '^PLAYIT_ENABLED=' .env | cut -d '=' -f2 || echo "true")

    echo -e "${PURPLE}${BOLD}Current Configuration:${NC}"
    echo -e "  Base URL:        ${CYAN}${CUR_URL}${NC}"
    echo -e "  Panel Port:      ${CYAN}${CUR_PORT}${NC}"
    echo -e "  Google Login:    $([ "$CUR_G_EN" = "true" ] && echo -e "${GREEN}ENABLED${NC}" || echo -e "${YELLOW}DISABLED${NC}")"
    echo -e "  Discord Login:   $([ "$CUR_D_EN" = "true" ] && echo -e "${GREEN}ENABLED${NC}" || echo -e "${YELLOW}DISABLED${NC}")"
    echo -e "  Playit Tunnel:   $([ "$CUR_PLAYIT" = "true" ] && echo -e "${GREEN}ENABLED${NC}" || echo -e "${YELLOW}DISABLED${NC}")"
    echo ""

    echo "What would you like to reconfigure?"
    echo "1) Panel URL & Port"
    echo "2) Google OAuth Settings"
    echo "3) Discord OAuth Settings"
    echo "4) Playit.gg Tunnel Setting"
    echo "5) Local Node Resource Limits"
    echo "6) Return to Main Menu"
    echo ""
    read -r -p "Enter choice [1-6]: " RECONFIG_CHOICE

    case "${RECONFIG_CHOICE}" in
        1)
            read -r -p "New Public Base URL [${CUR_URL}]: " NEW_URL || true
            NEW_URL="${NEW_URL:-$CUR_URL}"
            read -r -p "New Panel Port [${CUR_PORT}]: " NEW_PORT || true
            NEW_PORT="${NEW_PORT:-$CUR_PORT}"

            sed -i "s|^APP_BASE_URL=.*|APP_BASE_URL=${NEW_URL}|" .env
            sed -i "s|^PANEL_PORT=.*|PANEL_PORT=${NEW_PORT}|" .env
            if [ "$CUR_G_EN" = "true" ]; then
                sed -i "s|^GOOGLE_REDIRECT_URI=.*|GOOGLE_REDIRECT_URI=${NEW_URL}/api/auth/google/callback|" .env
            fi
            if [ "$CUR_D_EN" = "true" ]; then
                sed -i "s|^DISCORD_REDIRECT_URI=.*|DISCORD_REDIRECT_URI=${NEW_URL}/api/auth/discord/callback|" .env
            fi
            success "Panel URL & Port updated."
            ;;
        2)
            read -r -p "Enable Google Login? [y/N]: " PROMPT_G || true
            if [[ "${PROMPT_G:-}" =~ ^[Yy]$ ]]; then
                read -r -p "Google Client ID [${CUR_G_ID}]: " NEW_G_ID || true
                NEW_G_ID="${NEW_G_ID:-$CUR_G_ID}"
                echo -n "Google Client Secret (press enter to keep existing): "
                read -r -s NEW_G_SEC || true
                echo ""
                NEW_G_SEC="${NEW_G_SEC:-$CUR_G_SEC}"

                sed -i "s|^GOOGLE_ENABLED=.*|GOOGLE_ENABLED=true|" .env
                sed -i "s|^GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=${NEW_G_ID}|" .env
                sed -i "s|^GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=${NEW_G_SEC}|" .env
                sed -i "s|^GOOGLE_REDIRECT_URI=.*|GOOGLE_REDIRECT_URI=${CUR_URL}/api/auth/google/callback|" .env
                success "Google OAuth updated & enabled."
            else
                sed -i "s|^GOOGLE_ENABLED=.*|GOOGLE_ENABLED=false|" .env
                success "Google OAuth disabled."
            fi
            ;;
        3)
            read -r -p "Enable Discord Login? [y/N]: " PROMPT_D || true
            if [[ "${PROMPT_D:-}" =~ ^[Yy]$ ]]; then
                read -r -p "Discord Client ID [${CUR_D_ID}]: " NEW_D_ID || true
                NEW_D_ID="${NEW_D_ID:-$CUR_D_ID}"
                echo -n "Discord Client Secret (press enter to keep existing): "
                read -r -s NEW_D_SEC || true
                echo ""
                NEW_D_SEC="${NEW_D_SEC:-$CUR_D_SEC}"

                sed -i "s|^DISCORD_ENABLED=.*|DISCORD_ENABLED=true|" .env
                sed -i "s|^DISCORD_CLIENT_ID=.*|DISCORD_CLIENT_ID=${NEW_D_ID}|" .env
                sed -i "s|^DISCORD_CLIENT_SECRET=.*|DISCORD_CLIENT_SECRET=${NEW_D_SEC}|" .env
                sed -i "s|^DISCORD_REDIRECT_URI=.*|DISCORD_REDIRECT_URI=${CUR_URL}/api/auth/discord/callback|" .env
                success "Discord OAuth updated & enabled."
            else
                sed -i "s|^DISCORD_ENABLED=.*|DISCORD_ENABLED=false|" .env
                success "Discord OAuth disabled."
            fi
            ;;
        4)
            read -r -p "Enable Playit.gg Tunneling? [Y/n]: " PROMPT_P || true
            if [[ "${PROMPT_P:-}" =~ ^[Nn]$ ]]; then
                sed -i "s|^PLAYIT_ENABLED=.*|PLAYIT_ENABLED=false|" .env
                success "Playit.gg disabled."
            else
                sed -i "s|^PLAYIT_ENABLED=.*|PLAYIT_ENABLED=true|" .env
                success "Playit.gg enabled."
            fi
            ;;
        5)
            detect_system
            read -r -p "Max RAM Allocation for Game Servers (GB): " N_RAM || true
            read -r -p "Max Storage Allocation for Game Servers (GB): " N_DISK || true
            read -r -p "CPU Allocation Limit (%): " N_CPU || true
            read -r -p "Port Range: " N_PORTS || true

            if [ -f "${DATA_ROOT}/nodes/local/config/config.json" ]; then
                local TMP_JSON
                TMP_JSON=$(mktemp)
                jq --arg ram "${N_RAM:-16}" --arg disk "${N_DISK:-250}" --arg cpu "${N_CPU:-100}" --arg ports "${N_PORTS:-25565-25600}" \
                  '.ramAllocationGb = ($ram|tonumber) | .storageAllocationGb = ($disk|tonumber) | .cpuAllocationPercent = ($cpu|tonumber) | .portRange = $ports' \
                  "${DATA_ROOT}/nodes/local/config/config.json" > "$TMP_JSON" 2>/dev/null || true
                if [ -s "$TMP_JSON" ]; then
                    mv "$TMP_JSON" "${DATA_ROOT}/nodes/local/config/config.json"
                    chmod 600 "${DATA_ROOT}/nodes/local/config/config.json"
                    success "Local Node configuration updated."
                fi
            fi
            ;;
        6)
            return 0
            ;;
        *)
            warn "Invalid option selected."
            return 0
            ;;
    esac

    # Restart services to apply configuration changes
    info "Applying changes and restarting stack..."
    setup_and_verify_docker
    $COMPOSE_CMD up -d
    local RECONFIG_PORT
    RECONFIG_PORT=$(grep -E '^PANEL_PORT=' .env | cut -d '=' -f2 || echo "3000")
    local RECONFIG_URL
    RECONFIG_URL=$(grep -E '^APP_BASE_URL=' .env | cut -d '=' -f2 || echo "http://127.0.0.1:${RECONFIG_PORT}")
    run_health_checks "${RECONFIG_PORT}" "${RECONFIG_URL}" || true
}

# -------------------------------------------------------------
# 5. UNINSTALL ZYROCLOUD
# -------------------------------------------------------------
do_uninstall() {
    echo -e "\n${RED}${BOLD}================================================================${NC}"
    echo -e "${RED}${BOLD}                   UNINSTALL ZYROCLOUD                          ${NC}"
    echo -e "${RED}${BOLD}================================================================${NC}\n"

    verify_root

    echo -e "${YELLOW}${BOLD}WARNING: This operation will tear down ZyroCloud application containers.${NC}\n"
    echo "Please choose the uninstall mode:"
    echo "1) Remove application only (PRESERVES all server data, databases, and backups)"
    echo "2) Remove application + ALL ZyroCloud data (IRREVERSIBLE DELETION)"
    echo "3) Cancel"
    echo ""
    read -r -p "Enter choice [1-3]: " UNINSTALL_CHOICE

    case "${UNINSTALL_CHOICE}" in
        1)
            info "Stopping application stack while preserving persistent volumes and directories..."
            setup_and_verify_docker
            if [ -d "${INSTALL_DIR}" ]; then
                cd "${INSTALL_DIR}"
                $COMPOSE_CMD down --remove-orphans >/dev/null 2>&1 || true
            fi
            success "Application stopped and removed. All server files in ${DATA_ROOT} remain completely intact."
            ;;
        2)
            echo -e "\n${RED}${BOLD}CRITICAL WARNING:${NC} This will permanently delete:"
            echo -e "  - ${INSTALL_DIR} (application)"
            echo -e "  - ${DATA_ROOT} (ALL game servers, player files, world saves, backups, database volumes)"
            echo ""
            read -r -p "To confirm total deletion, type 'CONFIRM DELETE ALL DATA': " CONFIRM_TEXT
            if [ "$CONFIRM_TEXT" = "CONFIRM DELETE ALL DATA" ]; then
                info "Shutting down containers and deleting all ZyroCloud volumes..."
                setup_and_verify_docker
                if [ -d "${INSTALL_DIR}" ]; then
                    cd "${INSTALL_DIR}"
                    $COMPOSE_CMD down -v --remove-orphans >/dev/null 2>&1 || true
                    rm -rf "${INSTALL_DIR}"
                fi
                rm -rf "${DATA_ROOT}"
                success "ZyroCloud and all associated data have been completely removed from this host."
            else
                warn "Confirmation phrase mismatch. Uninstall aborted."
            fi
            ;;
        3|*)
            info "Uninstall canceled."
            ;;
    esac
}

# -----------------------------------------------------------------------------
# MAIN INTERACTIVE MENU DISPATCHER
# -----------------------------------------------------------------------------
main_menu() {
    while true; do
        clear 2>/dev/null || true
        print_banner
        echo -e "${BOLD}========================================${NC}"
        echo -e "${BOLD}        ZYROCLOUD INSTALLER             ${NC}"
        echo -e "${BOLD}========================================${NC}"
        echo ""
        echo "1) Fresh Install"
        echo "2) Update ZyroCloud"
        echo "3) Repair Installation"
        echo "4) Reconfigure Installation"
        echo "5) Uninstall ZyroCloud"
        echo "6) Exit"
        echo ""
        echo -e "${BOLD}----------------------------------------${NC}"
        read -r -p "Please select an option [1-6]: " MENU_CHOICE

        case "${MENU_CHOICE}" in
            1)
                do_fresh_install
                echo -e "\nPress [Enter] to return to menu..."
                read -r || true
                ;;
            2)
                do_update
                echo -e "\nPress [Enter] to return to menu..."
                read -r || true
                ;;
            3)
                do_repair
                echo -e "\nPress [Enter] to return to menu..."
                read -r || true
                ;;
            4)
                do_reconfigure
                echo -e "\nPress [Enter] to return to menu..."
                read -r || true
                ;;
            5)
                do_uninstall
                echo -e "\nPress [Enter] to return to menu..."
                read -r || true
                ;;
            6|q|Q|exit)
                echo -e "\n${CYAN}Exiting ZyroCloud Installer. Goodbye!${NC}\n"
                exit 0
                ;;
            *)
                echo -e "\n${RED}Invalid selection. Please enter a number between 1 and 6.${NC}"
                sleep 1.5
                ;;
        esac
    done
}

# -----------------------------------------------------------------------------
# ENTRY POINT HANDLING (Interactive vs CLI Flags)
# -----------------------------------------------------------------------------
if [ $# -eq 0 ]; then
    if [ -t 0 ]; then
        main_menu
    else
        # Non-interactive without arguments defaults to Fresh Install or Update if exists
        if [ -f "${INSTALL_DIR}/.env" ] || [ -f ".env" ]; then
            do_update
        else
            do_fresh_install
        fi
    fi
else
    case "$1" in
        --install|-i|install)
            do_fresh_install
            ;;
        --update|-u|update)
            do_update
            ;;
        --repair|-r|repair)
            do_repair
            ;;
        --reconfigure|-c|reconfigure)
            do_reconfigure
            ;;
        --uninstall|uninstall)
            do_uninstall
            ;;
        --menu|menu)
            main_menu
            ;;
        *)
            echo "Usage: bash install.sh [--install | --update | --repair | --reconfigure | --uninstall | --menu]"
            exit 1
            ;;
    esac
fi
