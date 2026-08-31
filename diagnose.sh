#!/usr/bin/env bash
# ==============================================================================
# ZYROCLOUD CONTROL PANEL - COMPREHENSIVE SYSTEM DIAGNOSTICS
# ==============================================================================
set -u

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${CYAN}${BOLD}================================================================${NC}"
echo -e "${CYAN}${BOLD}       ZYROCLOUD AUTOMATED SYSTEM & HOST DIAGNOSTICS           ${NC}"
echo -e "${CYAN}${BOLD}================================================================${NC}\n"

echo -e "${BOLD}1. OPERATING SYSTEM & ARCHITECTURE:${NC}"
uname -a
if [ -f /etc/os-release ]; then
    grep -E '^(PRETTY_NAME|ID|VERSION_ID)=' /etc/os-release
fi

echo -e "\n${BOLD}2. HARDWARE RESOURCES:${NC}"
echo -n "CPU Cores: " && nproc 2>/dev/null || echo "N/A"
echo "Memory Utilization:"
free -h 2>/dev/null || cat /proc/meminfo | grep -E '^(MemTotal|MemFree|MemAvailable):'
echo -e "\nDisk Utilization (/ and /var/lib/zyrocloud):"
df -h / /var/lib/zyrocloud 2>/dev/null || df -h /

echo -e "\n${BOLD}3. DOCKER ENGINE STATUS:${NC}"
if command -v docker >/dev/null 2>&1; then
    docker --version
    if docker info >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Docker daemon is running.${NC}"
        echo -n "Active Containers: " && docker ps -q | wc -l
        echo -n "Total Containers: " && docker ps -a -q | wc -l
    else
        echo -e "${RED}✗ Docker daemon is unreachable.${NC}"
    fi
else
    echo -e "${RED}✗ Docker is not installed.${NC}"
fi

echo -e "\n${BOLD}4. LOCAL NODE AGENT STATUS:${NC}"
if [ -d "/var/lib/zyrocloud/nodes" ]; then
    NODE_COUNT=$(find /var/lib/zyrocloud/nodes -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l)
    echo -e "Configured Nodes: ${NODE_COUNT}"
    for NDIR in /var/lib/zyrocloud/nodes/*; do
        if [ -d "$NDIR" ]; then
            NID=$(basename "$NDIR")
            PID_FILE="${NDIR}/runtime/node-agent.pid"
            LOG_FILE="${NDIR}/logs/agent.log"
            STATUS="UNKNOWN"
            if [ -f "$PID_FILE" ]; then
                NPID=$(cat "$PID_FILE" 2>/dev/null || echo "")
                if [ -n "$NPID" ] && kill -0 "$NPID" 2>/dev/null; then
                    STATUS="RUNNING (PID $NPID)"
                else
                    STATUS="STOPPED (Stale PID)"
                fi
            else
                STATUS="STANDBY / PANEL SUPERVISED"
            fi
            echo -e "  - Node [${NID}]: ${GREEN}${STATUS}${NC}"
            if [ -f "$LOG_FILE" ]; then
                echo "    Latest log: $(tail -n 1 "$LOG_FILE" 2>/dev/null)"
            fi
        fi
    done
else
    echo -e "${YELLOW}No /var/lib/zyrocloud/nodes directory found.${NC}"
fi

echo -e "\n${BOLD}5. DATA DIRECTORIES INTEGRITY:${NC}"
for DIR in /var/lib/zyrocloud/nodes /var/lib/zyrocloud/servers /var/lib/zyrocloud/playit /var/lib/zyrocloud/backups /var/lib/zyrocloud/logs /var/lib/zyrocloud/runtime /var/lib/zyrocloud/temp; do
    if [ -d "$DIR" ]; then
        COUNT=$(find "$DIR" -maxdepth 1 2>/dev/null | wc -l)
        echo -e "  ${DIR}: ${GREEN}EXISTS${NC} (${COUNT} entries)"
    else
        echo -e "  ${DIR}: ${YELLOW}NOT CREATED${NC}"
    fi
done

echo -e "\n${BOLD}6. OAUTH CONFIGURATION STATUS:${NC}"
if [ -f ".env" ]; then
    G_EN=$(grep -E '^GOOGLE_ENABLED=' .env | cut -d '=' -f2 || echo "false")
    D_EN=$(grep -E '^DISCORD_ENABLED=' .env | cut -d '=' -f2 || echo "false")
    echo -e "  Google Login:  $([ "$G_EN" = "true" ] && echo -e "${GREEN}ENABLED${NC}" || echo -e "${YELLOW}DISABLED${NC}")"
    echo -e "  Discord Login: $([ "$D_EN" = "true" ] && echo -e "${GREEN}ENABLED${NC}" || echo -e "${YELLOW}DISABLED${NC}")"
else
    echo "  .env file not found in current directory."
fi

echo -e "\n${BOLD}7. LOCAL API HEALTH CHECK:${NC}"
HEALTH_STATUS=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health 2>/dev/null || echo "UNREACHABLE")
if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Application Health Check: 200 OK${NC}"
else
    echo -e "${RED}✗ Application Health Check: ${HEALTH_STATUS}${NC}"
fi

echo -e "\n${BOLD}8. RECENT CONTAINER / APP LOGS:${NC}"
if command -v docker >/dev/null 2>&1; then
    docker logs --tail 20 zyrocloud-backend 2>/dev/null || echo "No zyrocloud-backend docker container running."
fi

echo -e "\n${CYAN}${BOLD}================================================================${NC}"
echo -e "${CYAN}${BOLD}   DIAGNOSTIC SUMMARY COMPLETE                                  ${NC}"
echo -e "${CYAN}${BOLD}================================================================${NC}\n"
