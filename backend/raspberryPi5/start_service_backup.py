#!/usr/bin/env python3
import os
import subprocess
import sys


def main():
    """Start the backend server"""
    try:
        # Change to backend directory
        backend_dir = "/home/student/Project/project-one/backend"
        os.chdir(backend_dir)

        # Use the backend-specific virtual environment used by the systemd service.
        venv_python = "/home/student/Project/project-one/backend/venv/bin/python"
        if not os.path.isfile(venv_python):
            print(f"Python executable not found: {venv_python}")
            sys.exit(1)

        # Start the server using python3 app.py (which runs the ASGI app with Socket.IO)
        cmd = [venv_python, "app.py"]

        print("Starting backend server...")
        subprocess.run(cmd)

    except Exception as e:
        print(f"Error starting backend: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
