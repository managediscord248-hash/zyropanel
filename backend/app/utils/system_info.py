import os
import time
import psutil

START_TIME = time.time()

def get_system_metrics() -> dict:
    """Returns actual host/node telemetry metrics."""
    cpu_percent = psutil.cpu_percent(interval=None)
    cpu_count = psutil.cpu_count(logical=True) or 1
    
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()
    
    return {
        "cpu_percent": float(cpu_percent),
        "cpu_cores": int(cpu_count),
        "memory_used_mb": round(mem.used / (1024 * 1024), 2),
        "memory_total_mb": round(mem.total / (1024 * 1024), 2),
        "memory_percent": float(mem.percent),
        "disk_used_gb": round(disk.used / (1024 * 1024 * 1024), 2),
        "disk_total_gb": round(disk.total / (1024 * 1024 * 1024), 2),
        "disk_percent": float(disk.percent),
        "network_rx_bytes": int(net.bytes_recv),
        "network_tx_bytes": int(net.bytes_sent),
        "uptime_seconds": int(time.time() - START_TIME),
    }
