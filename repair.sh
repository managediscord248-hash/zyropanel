#!/usr/bin/env bash
# ==============================================================================
# ZYROCLOUD CONTROL PANEL - SAFE REPAIR & REBUILD SCRIPT
# ==============================================================================
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${CYAN}${BOLD}=== ZYROCLOUD SAFE REPAIR UTILITY ===${NC}"
echo -e "${YELLOW}Preserving database, server files, node configurations, backups, and user accounts...${NC}\n"

# Verify Root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[ERROR] Please execute repair.sh with root privileges (sudo bash repair.sh).${NC}"
    exit 1
fi

COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}[ERROR] Docker Compose binary not found.${NC}"
    exit 1
fi

# Step 1: Ensure directory isolation integrity
echo -e "${CYAN}[1/5] Verifying persistent volume directories...${NC}"
for DIR in /var/lib/zyrocloud/nodes /var/lib/zyrocloud/servers /var/lib/zyrocloud/playit /var/lib/zyrocloud/backups /var/lib/zyrocloud/logs /var/lib/zyrocloud/runtime /var/lib/zyrocloud/temp /var/lib/zyrocloud/templates; do
    mkdir -p "$DIR"
    chmod 750 "$DIR"
done

# Step 2: Clean dangling images and containers without touching persistent volumes
echo -e "${CYAN}[2/5] Cleaning stale and stopped containers...${NC}"
$COMPOSE_CMD down --remove-orphans || true

# Step 3: Rebuild images
echo -e "${CYAN}[3/5] Recompiling container images...${NC}"
$COMPOSE_CMD build --pull || $COMPOSE_CMD build

# Step 4: Restart application stack
echo -e "${CYAN}[4/5] Starting ZyroCloud services...${NC}"
$COMPOSE_CMD up -d

# Step 5: Verify health check
echo -e "${CYAN}[5/5] Performing self-test health verification...${NC}"
MAX_RETRIES=20
RETRY_COUNT=0
HEALTH_OK=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" -eq 200 ]; then
        HEALTH_OK=1
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 2
done

if [ "$HEALTH_OK" -eq 1 ]; then
    echo -e "\n${GREEN}${BOLD}✓ ZyroCloud repaired successfully and all services are healthy!${NC}"
else
    echo -e "\n${RED}${BOLD}⚠ Health check returned $HTTP_CODE. Please check 'docker logs zyrocloud-backend'.${NC}"
fi
