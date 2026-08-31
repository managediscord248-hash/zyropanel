FROM python:3.11-slim

WORKDIR /app

# Install system utilities, Docker CLI, curl, tar, playit dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tar \
    git \
    procps \
    ca-certificates \
    gnupg \
    lsb-release \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update && apt-get install -y --no-install-recommends docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# Download official Playit binary for optional host tunneling
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then PLAYIT_ARCH="x86_64"; \
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then PLAYIT_ARCH="aarch64"; \
    else PLAYIT_ARCH="x86_64"; fi && \
    curl -SsL "https://github.com/playit-cloud/playit-agent/releases/download/v0.15.26/playit-linux-${PLAYIT_ARCH}" -o /usr/local/bin/playit && \
    chmod +x /usr/local/bin/playit || true

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ensure standard storage directories exist
RUN mkdir -p /var/lib/zyrocloud/servers \
    /var/lib/zyrocloud/backups \
    /var/lib/zyrocloud/playit \
    /var/lib/zyrocloud/logs \
    /var/lib/zyrocloud/templates

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
