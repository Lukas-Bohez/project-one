import threading
import time
import subprocess
import sys
import re
import os
import signal
from queue import Queue
import logging

class AppMonitor(threading.Thread):
    def __init__(self, log_file_path, app_path, check_interval=10, max_restarts=5):
        super().__init__()
        self.log_file_path = log_file_path
        self.app_path = app_path
        self.check_interval = check_interval
        self.max_restarts = max_restarts
        self.restart_count = 0
        self.last_restart_time = 0
        
        # Configure error patterns to monitor
        self.error_patterns = [
            r"Query error: weakly-referenced object no longer exists",
            r"Query error: 2013 \(HY000\): Lost connection to MySQL server during query",
            r"Error in emit_theme_selection_if_needed: 'NoneType' object has no attribute 'get'",
            r"malloc\(\): mismatching next->prev_size \(unsorted\)",
            r"Critical error",
            r"RuntimeError",
            r"Connection lost",
            r"Database connection failure"
        ]
        
        self.running = True
        self.process = None
        self.error_queue = Queue()
        self.setup_logging()
        
    def setup_logging(self):
        """Configure logging for the monitor"""
        self.logger = logging.getLogger('AppMonitor')
        self.logger.setLevel(logging.INFO)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        
        # Log to console
        ch = logging.StreamHandler()
        ch.setFormatter(formatter)
        self.logger.addHandler(ch)
        
        # Log to file
        fh = logging.FileHandler('monitor.log')
        fh.setFormatter(formatter)
        self.logger.addHandler(fh)
    
    def run(self):
        """Main monitoring loop"""
        self.logger.info("Starting application monitor")
        self.start_application()
        
        while self.running:
            try:
                # Check application status
                self.check_application_status()
                
                # Check logs for errors
                self.check_logs()
                
                # Process any detected errors
                self.process_errors()
                
                # Prevent restart flooding
                self.check_restart_rate()
                
                time.sleep(self.check_interval)
                
            except Exception as e:
                self.logger.error(f"Monitor error: {str(e)}", exc_info=True)
                time.sleep(5)  # Wait before continuing after error
    
    def check_application_status(self):
        """Check if application is running and responsive"""
        if self.process is None or self.process.poll() is not None:
            self.logger.warning("Application not running, attempting restart...")
            self.restart_application()
    
    def process_errors(self):
        """Process any errors found in the queue"""
        while not self.error_queue.empty():
            error = self.error_queue.get()
            self.logger.error(f"Detected critical error: {error}")
            self.restart_application()
    
    def check_restart_rate(self):
        """Prevent excessive restart attempts"""
        current_time = time.time()
        if current_time - self.last_restart_time < 60:  # Within 1 minute
            self.restart_count += 1
        else:
            self.restart_count = 1
        
        self.last_restart_time = current_time
        
        if self.restart_count >= self.max_restarts:
            self.logger.critical(f"Maximum restart attempts ({self.max_restarts}) reached. Shutting down.")
            self.stop()
            sys.exit(1)
    
    def start_application(self):
        """Start the application process with clean environment"""
        try:
            # Ensure any existing process is terminated
            self.terminate_process()
            
            # Start new process with clean environment
            env = os.environ.copy()
            self.process = subprocess.Popen(
                [sys.executable, self.app_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                env=env,
                preexec_fn=os.setsid  # Create new process group
            )
            
            # Start threads to monitor stdout/stderr
            threading.Thread(target=self.log_output, args=(self.process.stdout, "STDOUT")).start()
            threading.Thread(target=self.log_output, args=(self.process.stderr, "STDERR")).start()
            
            self.logger.info("Application started successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to start application: {str(e)}", exc_info=True)
            raise
    
    def log_output(self, stream, stream_name):
        """Log application output in real-time"""
        try:
            for line in iter(stream.readline, ''):
                line = line.strip()
                if line:
                    self.logger.info(f"{stream_name}: {line}")
                    
                    # Check for errors in real-time output
                    for pattern in self.error_patterns:
                        if re.search(pattern, line):
                            self.error_queue.put(line)
                            break
        except ValueError:
            pass  # Stream closed
    
    def restart_application(self):
        """Restart the application with cleanup"""
        self.logger.info("Restarting application...")
        try:
            self.terminate_process()
            time.sleep(1)  # Brief pause before restart
            self.start_application()
        except Exception as e:
            self.logger.error(f"Failed to restart application: {str(e)}", exc_info=True)
            raise
    
    def terminate_process(self):
        """Terminate the application process thoroughly"""
        if self.process:
            try:
                # Try graceful termination first
                self.process.terminate()
                
                # Wait briefly for process to exit
                for _ in range(5):
                    if self.process.poll() is not None:
                        break
                    time.sleep(0.5)
                
                # Force kill if still running
                if self.process.poll() is None:
                    os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
                
                # Ensure process is cleaned up
                self.process.wait(timeout=5)
                
            except Exception as e:
                self.logger.warning(f"Error terminating process: {str(e)}")
            finally:
                self.process = None
    
    def check_logs(self):
        """Check the log file for error patterns"""
        try:
            if not os.path.exists(self.log_file_path):
                self.logger.warning(f"Log file not found: {self.log_file_path}")
                return
                
            with open(self.log_file_path, 'r') as log_file:
                # Read the last few lines (adjust as needed)
                lines = log_file.readlines()[-200:]  # Increased buffer
                
                for line in lines:
                    for pattern in self.error_patterns:
                        if re.search(pattern, line):
                            self.error_queue.put(line.strip())
                            break
                            
        except Exception as e:
            self.logger.error(f"Error reading log file: {str(e)}", exc_info=True)
    
    def stop(self):
        """Stop the monitoring thread and application"""
        self.logger.info("Stopping application monitor...")
        self.running = False
        self.terminate_process()

def start_monitor(log_file_path, app_path, check_interval=10, max_restarts=5):
    """Start the application monitor"""
    monitor = AppMonitor(
        log_file_path=log_file_path,
        app_path=app_path,
        check_interval=check_interval,
        max_restarts=max_restarts
    )
    monitor.daemon = True  # Daemonize thread so it exits when main thread exits
    monitor.start()
    return monitor

if __name__ == "__main__":
    # Example usage
    log_file = "/home/student/Project/project-one/backend/app.log"
    app_path = "/home/student/Project/project-one/backend/app.py"
    
    monitor = start_monitor(
        log_file_path=log_file,
        app_path=app_path,
        check_interval=5,  # More frequent checks
        max_restarts=10    # Allow more restarts before giving up
    )
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down monitor...")
        monitor.stop()
        monitor.join()