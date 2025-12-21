#!/usr/bin/env python3
import subprocess
import sys
import os

def main():
    """Start the backend server"""
    try:
        # Change to backend directory
        backend_dir = "/home/student/Project/project-one/backend"
        os.chdir(backend_dir)
        
        # Activate virtual environment
        venv_python = "/home/student/Project/.venv/bin/python"
        
        # Start uvicorn
        cmd = [
            venv_python, "-m", "uvicorn", 
            "app:app", 
            "--host", "0.0.0.0", 
            "--port", "8001", 
            "--reload"
        ]
        
        print("Starting backend server...")
        subprocess.run(cmd)
        
    except Exception as e:
        print(f"Error starting backend: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
