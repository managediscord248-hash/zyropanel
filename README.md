# ZYROCLOUD — Self-Hosted Game Server Control Panel

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED.svg)](https://www.docker.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://reactjs.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC.svg)](https://tailwindcss.com/)

**ZyroCloud** is a production-grade, self-hosted game server hosting orchestration panel and control platform. Designed with a high-contrast dark cyberpunk HUD aesthetic, ZyroCloud delivers full Docker container lifecycle management, real-time WebSocket console streaming, strict per-server filesystem isolation with traversal prevention, automated backups, port allocations, and dedicated Playit.gg tunnel management.

---

## ⚡ Key Features

- **🛡️ Strict Filesystem & Storage Isolation**:
  Every server is assigned an immutable UUID with a dedicated root at `/var/lib/zyrocloud/servers/<server_id>/` containing isolated `data/`, `config/`, `logs/`, `runtime/`, `backups/`, and `metadata/` folders. Path resolution strictly prevents `../` traversal, symlink escapes, and null-byte injection.
- **🎮 Real Docker Container Lifecycle**:
  Full container orchestration: Create, Install, Pull image, Start, Stop, Restart, Kill, Delete, Inspect, live Log tailing, and real-time CPU/RAM/Disk stats querying from the Docker daemon.
- **📟 Real-time Interactive Console**:
  Sub-millisecond WebSocket terminal for container stdout/stderr log streaming, terminal clearing, auto-scrolling, and container command execution (`rcon`, `say`, `op`, `save-all`, etc.).
- **📂 Advanced Integrated File Manager**:
  Browse directory trees, open/edit configuration files with line numbers and syntax highlighting, create files and directories, drag-and-drop upload, download, rename, copy, and delete items.
- **🌐 Dedicated Playit.gg Subprocess Tunneling**:
  Dedicated background process manager (without systemd dependency) maintaining real PIDs, stdout/stderr log captures, claim codes, public domain routing (e.g. `*.ply.gg`), and dedicated Playit terminal.
- **🔒 Role-Based Access Control (RBAC)**:
  Granular `ADMIN` vs `USER` permission layers. Server ownership checks on every API endpoint prevent tampering with server IDs in the browser.
- **💾 Automated Backups**:
  Dedicated backup archives stored in `/var/lib/zyrocloud/backups/<server_id>/` with instant one-click restore and deletion.
- **🔌 Dynamic Port Allocation Engine**:
  Port collision prevention across nodes with support for custom ranges and multi-port allocations (e.g., query ports, RCON).

---

## 🚀 Quick Start (Automated Installer)

To install ZyroCloud on a fresh Linux VPS (Ubuntu, Debian, AlmaLinux, Rocky, Arch):

```bash
# 1. Clone repository
git clone https://github.com/your-org/zyrocloud.git /opt/zyrocloud
cd /opt/zyrocloud

# 2. Run the automated installer
chmod +x install.sh repair.sh diagnose.sh
sudo ./install.sh
```

The installer verifies CPU/RAM/Disk, provisions Docker runtime, configures PostgreSQL, generates cryptographically secure secrets, runs database migrations, boots services, and verifies API health.

---

## 🛠️ Management & Operations

### Safe Repair (Preserves Data & DB)
```bash
sudo ./repair.sh
```

### System & Health Diagnostics
```bash
sudo ./diagnose.sh
```

### Manual Docker Compose Control
```bash
docker compose up -d
docker compose logs -f backend
docker compose down
```

---

## 📁 System Architecture & Directory Tree

```text
/var/lib/zyrocloud/
├── servers/
│   └── <server-id>/
│       ├── data/        # Live world and server binary files
│       ├── config/      # Server properties and configurations
│       ├── logs/        # Server console and crash logs
│       ├── runtime/     # Ephemeral runtime lockfiles
│       ├── backups/     # Local backup staging
│       └── metadata/    # Server descriptor and quotas
├── backups/
│   └── <server-id>/     # Compressed .tar.gz backup snapshots
├── playit/
│   └── <server-id>/
│       └── <tunnel-id>/ # Isolated Playit config, state.json, playit.pid, logs
└── logs/                # System and audit logs
```

---

## 📡 REST API Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user & retrieve JWT |
| `GET` | `/api/auth/me` | Fetch active user profile |
| `GET` | `/api/servers` | List authorized game servers |
| `POST` | `/api/servers` | Provision new game server & container |
| `GET` | `/api/servers/{id}` | Inspect server details & state |
| `POST` | `/api/servers/{id}/power/{action}` | Power state: start, stop, restart, kill |
| `GET` | `/api/servers/{id}/stats` | Real Docker CPU/RAM/Disk telemetry |
| `GET` | `/api/servers/{id}/files/list` | List directory contents |
| `POST` | `/api/servers/{id}/files/write` | Write or update file content |
| `POST` | `/api/servers/{id}/playit/start` | Launch dedicated Playit tunnel process |
| `GET` | `/api/servers/{id}/playit/status` | Real Playit process PID and connection status |
| `GET` | `/api/nodes` | List compute nodes and resource capacities |
| `GET` | `/api/settings` | Retrieve dynamic branding and panel settings |
| `GET` | `/api/audit` | View tamper-resistant audit logs |
| `GET` | `/api/health` | Service health status |

---

## 🧪 Running Automated Tests

```bash
cd backend
pytest ../tests/ -v
```

---

## 📄 License
Licensed under the Apache License, Version 2.0.
