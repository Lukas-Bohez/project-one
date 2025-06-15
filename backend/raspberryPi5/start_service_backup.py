#!/usr/bin/env python3
import subprocess
import sys
import os
import time
import threading
import signal
from threading import Lock, Thread

# --- Use Pygame for joystick input ---
try:
    import pygame
except ImportError:
    print("Error: The 'pygame' library is not installed.")
    print("Please install it using: pip install pygame")
    sys.exit(1)


class SystemGamepadController:
    def __init__(self, debug=True):
        self.debug = debug
        self.running = True
        
        # --- Pygame-specific attributes ---
        self.joystick = None
        self.button_states = {
            'L': {'pressed': False, 'time': 0},
            'R': {'pressed': False, 'time': 0},
            'SELECT': {'pressed': False, 'time': 0}, # For future potential combos
            'START': {'pressed': False, 'time': 0}   # For future potential combos
        }
        self.button_lock = Lock()
        
        # Store subprocesses
        self.python_app_process = None
        self.browser_process = None
        
        # Define log file paths for easier debugging
        self.python_app_log_path = "/tmp/python_app.log"
        self.browser_log_path = "/tmp/browser.log"

        # Event to signal when services are ready
        self.services_ready = threading.Event()
        
        # Initialize components
        self.initialize_pygame()
        self.find_gamepad()
        
        # Start services in background thread
        self.service_thread = threading.Thread(target=self.start_services, daemon=True)
        self.service_thread.start()
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)

    def signal_handler(self, signum, frame):
        """Handle system signals for graceful shutdown"""
        print(f"\nReceived signal {signum}, shutting down gracefully...")
        self.running = False

    def initialize_pygame(self):
        """Initialize pygame for joystick input"""
        try:
            pygame.init()
            pygame.joystick.init()
            if self.debug:
                print("Pygame initialized successfully")
        except Exception as e:
            print(f"Failed to initialize pygame: {e}")
            print("Install pygame with: pip install pygame")
            sys.exit(1)

    def find_gamepad(self):
        """Find and initialize the gamepad device using pygame"""
        joystick_count = pygame.joystick.get_count()
        
        if joystick_count == 0:
            print("No joysticks/gamepads found!")
            print("Make sure your gamepad is connected and recognized by the system.")
            sys.exit(1)
        
        if self.debug:
            print(f"Found {joystick_count} joystick(s):")
            for i in range(joystick_count):
                joystick = pygame.joystick.Joystick(i)
                joystick.init()
                print(f"  {i}: {joystick.get_name()}")
                print(f"    Buttons: {joystick.get_numbuttons()}")
                print(f"    Axes: {joystick.get_numaxes()}")
                print(f"    Hats: {joystick.get_numhats()}")
        
        # Use the first joystick
        self.joystick = pygame.joystick.Joystick(0)
        self.joystick.init()
        
        if self.debug:
            print(f"\nUsing gamepad: {self.joystick.get_name()}")

    def start_services(self):
        """Start background services in a separate thread"""
        try:
            self.start_python_app()
            time.sleep(2)  # Give the Python app time to start
            self.start_default_browser()
            self.services_ready.set()  # Signal that services are ready
        except Exception as e:
            if self.debug:
                print(f"Error in service startup thread: {e}")

    def start_python_app(self):
        """Start the Python app in the background."""
        try:
            if self.debug:
                print("Starting Python application...")
            
            venv_python = "/home/student/Project/.venv/bin/python"
            script_path = "/home/student/Project/project-one/backend/raspberryPi5/appMonitor.py"
            
            if os.path.exists(venv_python) and os.path.exists(script_path):
                with open(self.python_app_log_path, 'w') as log_file:
                    self.python_app_process = subprocess.Popen(
                        [venv_python, script_path],
                        stdout=subprocess.DEVNULL,
                        stderr=log_file,
                        preexec_fn=os.setsid
                    )
                
                if self.debug:
                    print(f"✓ Python app started (PID: {self.python_app_process.pid})")
                
                time.sleep(1)
                if self.python_app_process.poll() is None:
                    if self.debug:
                        print("✓ Python app is running successfully")
                else:
                    if self.debug:
                        print(f"✗ Python app exited immediately. Check log for errors: {self.python_app_log_path}")
            else:
                if self.debug:
                    print("✗ Python app paths not found, skipping app startup.")
                    print(f"Checked: {venv_python}")
                    print(f"Checked: {script_path}")
                self.python_app_process = None
                
        except Exception as e:
            if self.debug:
                print(f"Error starting Python app: {e}")
            self.python_app_process = None

    def start_default_browser(self):
        """Launch the default web browser to a specific URL using xdg-open in fullscreen."""
        max_retries = 5
        retry_delay = 2
        target_url = "http://localhost"

        for attempt in range(max_retries):
            try:
                if self.debug:
                    print(f"Attempting to launch default browser (attempt {attempt + 1}/{max_retries})...")
                
                # Check if the target URL is accessible before launching the browser
                try:
                    import urllib.request
                    urllib.request.urlopen(target_url, timeout=3)
                    if self.debug:
                        print(f"✓ Target URL {target_url} is accessible")
                except Exception as url_error:
                    if self.debug:
                        print(f"⚠ Target URL not yet accessible: {url_error}")
                    if attempt < max_retries - 1:
                        print(f"Retrying in {retry_delay} seconds...")
                        time.sleep(retry_delay)
                        continue
                
                user_name = "student" 
                user_display = os.environ.get("DISPLAY", ":0")
                user_runtime_dir = os.environ.get("XDG_RUNTIME_DIR")
                
                # --- MODIFICATION START ---
                # To launch in fullscreen, we need to explicitly call a browser
                # and pass its fullscreen flag. This is a common approach for Wayland.
                # We'll try to launch Chromium-browser with --kiosk.
                # If 'chromium-browser' isn't found, xdg-open will act as a fallback,
                # but might not respect the kiosk flag directly.
                browser_cmd = ["chromium-browser", "--kiosk", target_url]
                
                launch_cmd = [
                    "sudo", "-u", user_name, 
                    "env",
                    f"DISPLAY={user_display}",
                ]
                if user_runtime_dir:
                    launch_cmd.append(f"XDG_RUNTIME_DIR={user_runtime_dir}")
                
                # Append the browser command to run within the user's environment
                launch_cmd.extend(browser_cmd)
                # --- MODIFICATION END ---

                with open(self.browser_log_path, 'w') as log_file:
                    self.browser_process = subprocess.Popen(
                        launch_cmd,
                        stdout=subprocess.DEVNULL,
                        stderr=log_file,
                        preexec_fn=os.setsid
                    )
                
                if self.debug:
                    print(f"✓ Fullscreen browser launch command sent (PID: {self.browser_process.pid})")
                
                time.sleep(2) 
                if self.browser_process.poll() is None:
                    if self.debug:
                        print("✓ Browser process is still running (potentially in kiosk mode)")
                else:
                    if self.debug:
                        print(f"⚠ Browser process exited with code {self.browser_process.returncode}. Check log: {self.browser_log_path}")
                        print("This might happen if the browser isn't installed or a Wayland issue.")
                return 

            except Exception as e:
                if self.debug:
                    print(f"Error launching default browser (attempt {attempt + 1}): {e}")
                
                if attempt < max_retries - 1:
                    print(f"Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                else:
                    self.browser_process = None

    def get_button_name(self, button_index):
        """Map button indices to SNES button names (L/R specifically)"""
        # This mapping is based on your provided SNESGamepadController's map
        # You might need to adjust it if your joystick reports L/R differently
        # For L/R buttons specifically:
        button_map = {
            4: 'L', 
            5: 'R'
        }
        return button_map.get(button_index, f'BTN{button_index}') # Return generic if not L/R

    def update_button_state(self, button, pressed):
        """Update button state with timestamp for combo checking"""
        with self.button_lock:
            if button in self.button_states:
                self.button_states[button]['pressed'] = pressed
                self.button_states[button]['time'] = time.time()
                if self.debug:
                    state = "pressed" if pressed else "released"
                    print(f"Button {button} {state}")

    def check_lr_combo(self):
        """Dedicated background thread to check for L+R button combination"""
        while self.running:
            time.sleep(0.1) # Check every 100ms
            
            with self.button_lock:
                l_pressed = self.button_states['L']['pressed']
                r_pressed = self.button_states['R']['pressed']
                l_time = self.button_states['L']['time']
                r_time = self.button_states['R']['time']

                # Check if both L and R are pressed and within a short time window
                if l_pressed and r_pressed and abs(l_time - r_time) < 0.3:
                    print("\nL+R combo detected - initiating system shutdown!")
                    self.shutdown_system()
                    # Reset button states and exit the loop as system is shutting down
                    self.button_states['L']['pressed'] = False
                    self.button_states['R']['pressed'] = False
                    self.running = False # Signal main loop to exit
                    sys.exit(0) # Exit the thread immediately

    def terminate_process_group(self, process, name):
        """Terminate a process and its entire process group"""
        if process and process.poll() is None:
            try:
                if self.debug:
                    print(f"Terminating {name} (PID: {process.pid})...")
                pgid = os.getpgid(process.pid)
                os.killpg(pgid, signal.SIGTERM)
                try:
                    process.wait(timeout=5)
                    if self.debug:
                        print(f"✓ {name} terminated gracefully.")
                except subprocess.TimeoutExpired:
                    if self.debug:
                        print(f"⚠ {name} did not terminate gracefully, killing...")
                    os.killpg(pgid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                if self.debug:
                    print(f"✓ {name} already terminated or no permission.")
            except Exception as e:
                if self.debug:
                    print(f"Error terminating {name}: {e}")

    def shutdown_system(self):
        """Shutdown the system and terminate launched processes."""
        try:
            print("Initiating system shutdown...")
            self.running = False 
            self.terminate_process_group(self.python_app_process, "Python application")
            self.terminate_process_group(self.browser_process, "Default browser via xdg-open")
            
            # Execute system poweroff command
            subprocess.run(["poweroff"], check=True, timeout=10)
            print("Shutdown command sent successfully.")

        except Exception as e:
            print(f"An unexpected error occurred during shutdown: {e}")
        finally:
            self.running = False

    def run(self):
        """Main execution loop for the controller."""
        print("\n--- System Gamepad Controller ---")
        print("---------------------------------")
        print("Controls:")
        print("   L+R buttons: Shutdown system")
        print(f"\nUsing device: {self.joystick.get_name()}")
        print("Starting services...")
        
        if self.services_ready.wait(timeout=30):
            print("✓ Services started successfully")
        else:
            print("⚠ Services startup timeout, continuing anyway...")
        
        print("Listening for L+R combo...\n")

        # Start the combo checking thread
        self.combo_checker = Thread(target=self.check_lr_combo)
        self.combo_checker.daemon = True
        self.combo_checker.start()

        try:
            # Main pygame event loop
            while self.running:
                for event in pygame.event.get():
                    if event.type == pygame.QUIT:
                        self.running = False
                        break
                    
                    elif event.type == pygame.JOYBUTTONDOWN:
                        button_name = self.get_button_name(event.button)
                        self.update_button_state(button_name, True)
                    
                    elif event.type == pygame.JOYBUTTONUP:
                        button_name = self.get_button_name(event.button)
                        self.update_button_state(button_name, False)
                
                # Small delay to prevent busy-waiting
                time.sleep(0.01) 
            
        except KeyboardInterrupt:
            print("\nUser interrupted (Ctrl+C). Exiting...")
        except Exception as e:
            print(f"\nError in main loop: {e}")
        finally:
            self.cleanup()

    def cleanup(self):
        """Clean up resources before exiting."""
        if self.running: # Only print if not already shutting down via combo
            print("Performing cleanup...")
        self.running = False
        self.terminate_process_group(self.python_app_process, "Python app")
        self.terminate_process_group(self.browser_process, "Default browser via xdg-open")
        
        # Ensure combo checker thread is joined
        if hasattr(self, 'combo_checker') and self.combo_checker.is_alive():
            self.combo_checker.join(timeout=1) # Give it a moment to finish
            if self.combo_checker.is_alive():
                print("Warning: Combo checker thread did not terminate.")

        if self.joystick:
            self.joystick.quit()
        pygame.quit()
        print("System Gamepad Controller stopped.")


if __name__ == "__main__":
    if os.geteuid() != 0:
        print("This script needs to be run as root. Please use sudo.")
        sys.exit(1)

    try:
        controller = SystemGamepadController(debug=True)
        controller.run()
    except Exception as e:
        print(f"Critical Error: {e}")
        if 'controller' in locals():
            controller.cleanup()
        sys.exit(1)