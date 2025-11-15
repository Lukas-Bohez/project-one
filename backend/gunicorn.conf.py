"""
Gunicorn configuration for production deployment with high concurrency support.
This configuration handles API overload by using multiple workers and async processing.
"""

import multiprocessing
import os

# Bind to all interfaces on port 8001
bind = "0.0.0.0:8001"

# Worker configuration - use 4 workers for better concurrency
# Formula: (2 * CPU cores) + 1 is recommended, but we'll use a conservative 4
# This allows 4 simultaneous request processing streams
workers = 4

# Worker class - use uvicorn workers for ASGI compatibility (FastAPI + Socket.IO)
worker_class = "uvicorn.workers.UvicornWorker"

# Async worker configuration
# Each worker can handle multiple concurrent connections via asyncio
# With 4 workers and proper async handling, we can serve hundreds of concurrent users
worker_connections = 1000  # Max concurrent connections per worker

# Timeout settings - important for long-running API calls
timeout = 120  # 2 minutes for requests (handles video processing)
graceful_timeout = 30  # 30 seconds for graceful shutdown
keepalive = 5  # Keep connections alive for 5 seconds

# Performance tuning
max_requests = 1000  # Restart workers after 1000 requests (prevents memory leaks)
max_requests_jitter = 50  # Add randomness to prevent all workers restarting at once
preload_app = True  # Load application before forking workers (saves memory)

# Logging
accesslog = "/home/student/Project/project-one/backend/logs/gunicorn_access.log"
errorlog = "/home/student/Project/project-one/backend/logs/gunicorn_error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "quizthespire_backend"

# Security - limit request line and header size
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190

# Forwarded headers (for proxy/load balancer support)
forwarded_allow_ips = "*"  # Trust all proxies (adjust for production)

# Worker lifecycle hooks
def on_starting(server):
    """Called just before the master process is initialized."""
    print("🚀 Gunicorn master process starting...")

def when_ready(server):
    """Called just after the server is started."""
    print("✅ Gunicorn is ready to accept connections")
    print(f"   Workers: {workers}")
    print(f"   Connections per worker: {worker_connections}")
    print(f"   Max concurrent: ~{workers * worker_connections}")

def worker_int(worker):
    """Called when a worker receives INT or QUIT signal."""
    print(f"⚠️  Worker {worker.pid} received termination signal")

def worker_abort(worker):
    """Called when a worker is forcefully killed."""
    print(f"❌ Worker {worker.pid} was forcefully terminated")

def on_exit(server):
    """Called when gunicorn is shutting down."""
    print("👋 Gunicorn master process shutting down")
