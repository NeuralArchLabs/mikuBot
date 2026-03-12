#!/usr/bin/env python3
"""Skill: System Info - Obtiene información del sistema"""

import json
import sys
import io
import platform
import os
from datetime import datetime, timedelta

# Force UTF-8 encoding in stdout for Windows compatibility
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Import psutil with automatic installation fallback
try:
    import psutil
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil", "-q"])
    import psutil


def system_info(detailed: bool = False) -> dict:
    """
    Obtiene información del sistema.
    
    Args:
        detailed: Información detallada
    
    Returns:
        Dict con información del sistema
    """
    try:
        # Información básica
        info = {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "hostname": platform.node(),
            "platform": platform.system(),
            "platform_release": platform.release(),
            "platform_version": platform.version(),
            "architecture": platform.machine(),
            "processor": platform.processor(),
            "python_version": platform.python_version()
        }
        
        # CPU
        cpu_count = psutil.cpu_count(logical=False) or 1
        cpu_count_logical = psutil.cpu_count(logical=True) or 1
        cpu_percent = psutil.cpu_percent(interval=0.1)
        
        info["cpu"] = {
            "physical_cores": cpu_count,
            "logical_cores": cpu_count_logical,
            "percent": cpu_percent,
            "freq": psutil.cpu_freq().current if psutil.cpu_freq() else None
        }
        
        # Memoria
        mem = psutil.virtual_memory()
        info["memory"] = {
            "total_gb": round(mem.total / (1024**3), 2),
            "used_gb": round(mem.used / (1024**3), 2),
            "available_gb": round(mem.available / (1024**3), 2),
            "percent": mem.percent
        }
        
        # Swap
        swap = psutil.swap_memory()
        info["swap"] = {
            "total_gb": round(swap.total / (1024**3), 2),
            "used_gb": round(swap.used / (1024**3), 2),
            "free_gb": round(swap.free / (1024**3), 2),
            "percent": swap.percent
        }
        
        # Uptime
        uptime_seconds = int(datetime.now().timestamp() - psutil.boot_time())
        uptime_delta = timedelta(seconds=uptime_seconds)
        info["uptime"] = {
            "seconds": uptime_seconds,
            "formatted": str(uptime_delta)
        }
        
        if detailed:
            # Discos
            disks = []
            for partition in psutil.disk_partitions(all=False):
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    disks.append({
                        "device": partition.device,
                        "mountpoint": partition.mountpoint,
                        "fstype": partition.fstype,
                        "total_gb": round(usage.total / (1024**3), 2),
                        "used_gb": round(usage.used / (1024**3), 2),
                        "free_gb": round(usage.free / (1024**3), 2),
                        "percent": usage.percent
                    })
                except (PermissionError, OSError):
                    continue
            
            info["disks"] = disks
            
            # Red
            net_if_stats = psutil.net_if_stats()
            networks = {}
            for name, stats in net_if_stats.items():
                networks[name] = {
                    "isup": stats.isup,
                    "speed": stats.speed,
                    "mtu": stats.mtu
                }
            
            info["networks"] = networks
            
            # Procesos principales
            info["total_processes"] = len(psutil.pids())
        
        return info
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }


if __name__ == "__main__":
    try:
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        result = system_info(**args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }))
