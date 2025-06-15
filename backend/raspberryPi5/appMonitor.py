import threading
import time
import subprocess
import sys
import re
from queue import Queue

class AppMonitor(threading.Thread):
    def __init__(self, log_file_path, app_path, check_interval=10):
        super().__init__()
        self.log_file_path = log_file_path
        self.app_path = app_path
        self.check_interval = check_interval
        self.error_patterns = [
            r"Query error: weakly-referenced object no longer exists",
            r"Query error: 2013 \(HY000\): Lost connection to MySQL server during query",
            r"Error in emit_theme_selection_if_needed: 'NoneType' object has no attribute 'get'",
            r"malloc\(\): mismatching next->prev_size \(unsorted\)"
        ]
        self.running = True
        self.process = None
        self.error_queue = Queue()
        
    def run(self):
        """Main monitoring loop"""
        self.start_application()
        
        while self.running:
            # Check log file for errors
            self.check_logs()
            
            # Check if application process is still running
            if self.process and self.process.poll() is not None:
                print("Application process has terminated, restarting...")
                self.start_application()
            
            # Check if we found any errors
            if not self.error_queue.empty():
                error = self.error_queue.get()
                print(f"Detected critical error: {error}")
                print("Restarting application...")
                self.restart_application()
            
            time.sleep(self.check_interval)
    
    def start_application(self):
        """Start the application process"""
        if self.process and self.process.poll() is None:
            self.process.terminate()
            self.process.wait()
        
        self.process = subprocess.Popen(
            [sys.executable, self.app_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True
        )
        print("Application started")
    
    def restart_application(self):
        """Restart the application"""
        if self.process:
            self.process.terminate()
            self.process.wait()
        self.start_application()
    
    def check_logs(self):
        """Check the log file for error patterns"""
        try:
            with open(self.log_file_path, 'r') as log_file:
                # Read the last few lines (adjust as needed)
                lines = log_file.readlines()[-100:]
                
                for line in lines:
                    for pattern in self.error_patterns:
                        if re.search(pattern, line):
                            self.error_queue.put(line.strip())
                            break
        except FileNotFoundError:
            print(f"Log file not found: {self.log_file_path}")
        except Exception as e:
            print(f"Error reading log file: {e}")
    
    def stop(self):
        """Stop the monitoring thread"""
        self.running = False
        if self.process:
            self.process.terminate()
            self.process.wait()

def start_monitor(log_file_path, app_path):
    """Start the application monitor"""
    monitor = AppMonitor(log_file_path, app_path)
    monitor.daemon = True  # Daemonize thread so it exits when main thread exits
    monitor.start()
    return monitor

if __name__ == "__main__":
    # Example usage
    log_file = "/home/student/Project/project-one/backend/app.log"  # Adjust to your log file path
    app_path = "/home/student/Project/project-one/backend/app.py"  # Your application path
    
    monitor = start_monitor(log_file, app_path)
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping monitor...")
        monitor.stop()