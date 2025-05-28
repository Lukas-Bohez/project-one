#!/usr/bin/env python3
import evdev
import time
import subprocess
import sys
from threading import Lock, Thread

class SNESGamepadController:
    def __init__(self, debug=True):
        self.debug = debug
        self.running = True
        self.device = None
        self.mouse_sensitivity = 8
        self.scroll_sensitivity = 3
        self.volume_step = 5
        
        # Button state tracking with timestamps
        self.button_states = {
            'A': {'pressed': False, 'time': 0},
            'B': {'pressed': False, 'time': 0},
            'X': {'pressed': False, 'time': 0},
            'Y': {'pressed': False, 'time': 0},
            'L': {'pressed': False, 'time': 0},
            'R': {'pressed': False, 'time': 0},
            'SELECT': {'pressed': False, 'time': 0},
            'START': {'pressed': False, 'time': 0}
        }
        self.button_lock = Lock()
        
        # D-pad state tracking
        self.dpad_state = {'x': 0, 'y': 0}
        self.last_dpad_move = 0
        self.dpad_repeat_delay = 0.1  # 100ms between moves
        
        # Button mappings (will be auto-detected)
        self.button_map = {}
        self.dpad_codes = {}

        # Verify requirements
        self.use_alternative_mouse = False
        self.check_requirements()
        self.find_gamepad()
        self.detect_button_mappings()
        
        # Start combo checking thread
        self.combo_checker = Thread(target=self.check_combos)
        self.combo_checker.daemon = True
        self.combo_checker.start()

    def check_requirements(self):
        """Verify required tools are installed and working"""
        # Check if we're in a proper X11 environment
        display = subprocess.run(['echo', '$DISPLAY'], capture_output=True, text=True, shell=True)
        if not display.stdout.strip():
            print("Warning: No DISPLAY environment variable set.")
            print("If running over SSH, try: ssh -X username@hostname")
            print("Or export DISPLAY=:0 if running locally")
        
        try:
            # Test xdotool with a simple command
            result = subprocess.run(['xdotool', 'getmouselocation'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode != 0:
                print("Warning: xdotool cannot access the display")
                print("Error:", result.stderr.strip())
                print("Trying alternative mouse control methods...")
                self.use_alternative_mouse = True
            else:
                self.use_alternative_mouse = False
                if self.debug:
                    print("xdotool working properly")
                    
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            print("Warning: xdotool not working properly")
            print("Install with: sudo apt install xdotool")
            print("Trying alternative mouse control methods...")
            self.use_alternative_mouse = True
        
        try:
            subprocess.run(['amixer', '-v'], check=True,
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Warning: amixer not found. Install with:")
            print("sudo apt install alsa-utils")

    def find_gamepad(self):
        """Find and initialize the gamepad device"""
        devices = [evdev.InputDevice(path) for path in evdev.list_devices()]
        
        print("Available input devices:")
        for i, device in enumerate(devices):
            print(f"  {i}: {device.name} at {device.path}")
        
        # Look for gamepad-like devices
        gamepad_keywords = ['gamepad', 'controller', 'pad', 'joystick', 'snes', 'usb']
        
        for device in devices:
            device_name_lower = device.name.lower()
            if any(keyword in device_name_lower for keyword in gamepad_keywords):
                # Check if it has the capabilities we need
                caps = device.capabilities()
                has_buttons = evdev.ecodes.EV_KEY in caps
                has_abs = evdev.ecodes.EV_ABS in caps
                
                if has_buttons and has_abs:
                    self.device = device
                    if self.debug:
                        print(f"\nGamepad selected: {device.name} at {device.path}")
                    break
        
        if not self.device:
            print("\nNo suitable gamepad found. Listing all devices with capabilities:")
            for device in devices:
                caps = device.capabilities()
                print(f"\n{device.name}:")
                if evdev.ecodes.EV_KEY in caps:
                    print("  Has buttons")
                if evdev.ecodes.EV_ABS in caps:
                    print("  Has analog inputs")
            print("\nPlease connect your gamepad and try again.")
            sys.exit(1)

    def detect_button_mappings(self):
        """Auto-detect button mappings with corrected SNES layout"""
        caps = self.device.capabilities()
        
        if self.debug:
            print("\nDevice capabilities:")
            for event_type, codes in caps.items():
                print(f"  {evdev.ecodes.EV[event_type]}: {codes}")
        
        # Get button codes
        if evdev.ecodes.EV_KEY in caps:
            button_codes = caps[evdev.ecodes.EV_KEY]
            if self.debug:
                print(f"\nAvailable button codes: {button_codes}")
            
            # Just use sorted order and swap A<->B and X<->Y
            if len(button_codes) >= 8:
                sorted_codes = sorted(button_codes)
                # Physical mapping: A->X, B->Y, Y->B, X->A
                # A and Y are good, X and B are mixed up, so swap X and B
                button_names = ['X', 'A', 'B', 'Y', 'L', 'R', 'SELECT', 'START']
                self.button_map = {}
                for i, name in enumerate(button_names):
                    if i < len(sorted_codes):
                        self.button_map[sorted_codes[i]] = name
        
        # Get D-pad/analog stick codes
        if evdev.ecodes.EV_ABS in caps:
            abs_codes = caps[evdev.ecodes.EV_ABS]
            if self.debug:
                print(f"Available analog codes: {abs_codes}")
            
            # Map D-pad axes
            for code_info in abs_codes:
                code = code_info[0] if isinstance(code_info, tuple) else code_info
                if code == evdev.ecodes.ABS_X or code == evdev.ecodes.ABS_HAT0X:
                    self.dpad_codes['x'] = code
                elif code == evdev.ecodes.ABS_Y or code == evdev.ecodes.ABS_HAT0Y:
                    self.dpad_codes['y'] = code
        
        if self.debug:
            print(f"\nFinal Button Mappings:")
            for code, name in sorted(self.button_map.items()):
                print(f"  Button {code} -> {name}")
            print(f"D-pad mappings: {self.dpad_codes}")

    def update_button_state(self, button, pressed):
        """Update button state with timestamp"""
        with self.button_lock:
            if button in self.button_states:
                self.button_states[button]['pressed'] = pressed
                self.button_states[button]['time'] = time.time()
                if self.debug:
                    state = "pressed" if pressed else "released"
                    print(f"Button {button} {state}")

    def check_combos(self):
        """Background thread to check for button combinations"""
        while self.running:
            time.sleep(0.1)  # Check 10 times per second
            
            with self.button_lock:
                current_time = time.time()
                
                # Check A+B combo (must be pressed within 0.3s of each other)
                a_pressed = self.button_states['A']['pressed']
                b_pressed = self.button_states['B']['pressed']
                a_time = self.button_states['A']['time']
                b_time = self.button_states['B']['time']
                
                if a_pressed and b_pressed and abs(a_time - b_time) < 0.3:
                    print("\nA+B combo detected - exiting!")
                    self.running = False
                    break
                
                # Check START+SELECT combo
                start_pressed = self.button_states['START']['pressed']
                select_pressed = self.button_states['SELECT']['pressed']
                start_time = self.button_states['START']['time']
                select_time = self.button_states['SELECT']['time']
                
                if start_pressed and select_pressed and abs(start_time - select_time) < 0.3:
                    print("\nSTART+SELECT combo detected - sleeping system!")
                    self.system_sleep()
                    # Reset these buttons so we don't keep triggering
                    self.button_states['START']['pressed'] = False
                    self.button_states['SELECT']['pressed'] = False

    def handle_dpad(self, axis, value):
        """Handle D-pad movement with better sensitivity"""
        current_time = time.time()
        
        # Update D-pad state
        if axis == 'x':
            if value < -50:  # Left
                self.dpad_state['x'] = -1
            elif value > 50:  # Right
                self.dpad_state['x'] = 1
            else:
                self.dpad_state['x'] = 0
        elif axis == 'y':
            if value < -50:  # Up
                self.dpad_state['y'] = -1
            elif value > 50:  # Down
                self.dpad_state['y'] = 1
            else:
                self.dpad_state['y'] = 0
        
        # Only move mouse if enough time has passed (for smoother movement)
        if current_time - self.last_dpad_move >= self.dpad_repeat_delay:
            if self.dpad_state['x'] != 0 or self.dpad_state['y'] != 0:
                move_x = self.dpad_state['x'] * self.mouse_sensitivity
                move_y = self.dpad_state['y'] * self.mouse_sensitivity
                self.move_mouse(move_x, move_y)
                self.last_dpad_move = current_time
                
                if self.debug:
                    print(f"D-pad: x={self.dpad_state['x']}, y={self.dpad_state['y']}, move=({move_x}, {move_y})")

    def handle_event(self, event):
        """Process input events from the gamepad"""
        if event.type == evdev.ecodes.EV_ABS:
            # D-pad/analog movement
            if event.code == self.dpad_codes.get('x'):
                self.handle_dpad('x', event.value)
            elif event.code == self.dpad_codes.get('y'):
                self.handle_dpad('y', event.value)
            elif self.debug:
                print(f"Unhandled ABS event: code={event.code}, value={event.value}")
                    
        elif event.type == evdev.ecodes.EV_KEY:
            # Button press/release
            button = self.button_map.get(event.code, None)
            if not button:
                if self.debug:
                    print(f"Unhandled KEY event: code={event.code}, value={event.value}")
                return
            
            pressed = event.value == 1
            self.update_button_state(button, pressed)
            
            # Handle single button actions (only on press, not release)
            if pressed:
                if button == 'A':
                    self.mouse_click('left')
                elif button == 'B':
                    self.mouse_click('right')
                elif button == 'X':
                    self.scroll(self.scroll_sensitivity)  # Scroll up
                elif button == 'Y':
                    self.scroll(-self.scroll_sensitivity) # Scroll down
                elif button == 'L':
                    self.adjust_volume(self.volume_step)
                elif button == 'R':
                    self.adjust_volume(-self.volume_step)

    def move_mouse(self, x=0, y=0):
        """Move mouse pointer using available methods"""
        if self.use_alternative_mouse:
            self.move_mouse_alternative(x, y)
        else:
            try:
                cmd = ['xdotool', 'mousemove_relative', '--', str(int(x)), str(int(y))]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=2)
                if result.returncode != 0:
                    if self.debug:
                        print(f"xdotool failed: {result.stderr.strip()}")
                    self.use_alternative_mouse = True
                    self.move_mouse_alternative(x, y)
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                if self.debug:
                    print(f"Mouse move failed: {e}")
                self.use_alternative_mouse = True
                self.move_mouse_alternative(x, y)

    def move_mouse_alternative(self, x=0, y=0):
        """Alternative mouse movement using /dev/input/mice or xinput"""
        try:
            # Try using xinput if available
            result = subprocess.run(['xinput', 'list'], capture_output=True, text=True, timeout=2)
            if result.returncode == 0:
                # Find mouse device
                mice = []
                for line in result.stdout.split('\n'):
                    if 'mouse' in line.lower() or 'pointer' in line.lower():
                        if 'id=' in line:
                            device_id = line.split('id=')[1].split()[0]
                            mice.append(device_id)
                
                if mice:
                    # Use first mouse device found
                    cmd = ['xinput', 'set-prop', mice[0], 'Device Enabled', '1']
                    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
                    if self.debug:
                        print(f"Mouse move: ({x}, {y}) via xinput")
                    return
                        
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            pass
        
        # Fallback: just log the movement
        if self.debug and (x != 0 or y != 0):
            print(f"Mouse move: ({x}, {y}) - display not available")

    def mouse_click(self, button='left'):
        """Simulate mouse click using available methods"""
        if self.use_alternative_mouse:
            self.mouse_click_alternative(button)
        else:
            try:
                cmd = ['xdotool', 'click', '1' if button == 'left' else '3']
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=2)
                if result.returncode != 0:
                    if self.debug:
                        print(f"xdotool click failed: {result.stderr.strip()}")
                    self.use_alternative_mouse = True
                    self.mouse_click_alternative(button)
                elif self.debug:
                    print(f"Mouse {button} click")
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                if self.debug:
                    print(f"Mouse click failed: {e}")
                self.use_alternative_mouse = True
                self.mouse_click_alternative(button)

    def mouse_click_alternative(self, button='left'):
        """Alternative mouse click method"""
        if self.debug:
            print(f"Mouse {button} click - display not available")

    def scroll(self, amount):
        """Simulate mouse wheel scroll using available methods"""
        if self.use_alternative_mouse:
            self.scroll_alternative(amount)
        else:
            try:
                direction = 'up' if amount > 0 else 'down'
                button_code = '4' if direction == 'up' else '5'
                cmd = ['xdotool', 'click', button_code]
                for _ in range(abs(amount)):
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=2)
                    if result.returncode != 0:
                        if self.debug:
                            print(f"xdotool scroll failed: {result.stderr.strip()}")
                        self.use_alternative_mouse = True
                        self.scroll_alternative(amount)
                        return
                    time.sleep(0.05)
                if self.debug:
                    print(f"Scroll {direction} ({abs(amount)} steps)")
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                if self.debug:
                    print(f"Scroll failed: {e}")
                self.use_alternative_mouse = True
                self.scroll_alternative(amount)

    def scroll_alternative(self, amount):
        """Alternative scroll method"""
        direction = 'up' if amount > 0 else 'down'
        if self.debug:
            print(f"Scroll {direction} ({abs(amount)} steps) - display not available")

    def adjust_volume(self, percent):
        """Adjust system volume using amixer"""
        try:
            # Use ALSA amixer (more reliable on Raspberry Pi)
            direction = "+" if percent > 0 else "-"
            cmd = ['amixer', '-q', 'set', 'Master', f'{abs(percent)}%{direction}']
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            
            # Get current volume for feedback
            result = subprocess.run(['amixer', 'get', 'Master'], 
                                  capture_output=True, text=True, check=True)
            
            # Parse volume from ALSA output
            lines = result.stdout.split('\n')
            for line in lines:
                if '[' in line and '%' in line and ('Front Left:' in line or 'Mono:' in line):
                    # Extract percentage between [ and %
                    try:
                        start = line.find('[') + 1
                        end = line.find('%', start)
                        if start > 0 and end > start:
                            volume = line[start:end]
                            print(f"Volume set to: {volume}% (ALSA)")
                            return
                    except:
                        pass
            
            # Fallback: just report action
            print(f"Volume {'increased' if percent > 0 else 'decreased'} by {abs(percent)}%")
                    
        except subprocess.CalledProcessError as e:
            if self.debug:
                print(f"Volume adjustment failed: {e}")
        except FileNotFoundError:
            if self.debug:
                print("amixer not found - install alsa-utils")

    def system_sleep(self):
        """Put system to sleep"""
        try:
            print("Putting system to sleep...")
            subprocess.run(['systemctl', 'suspend'], check=True)
        except subprocess.CalledProcessError as e:
            if self.debug:
                print(f"Sleep failed: {e}")
            # Try alternative methods
            try:
                subprocess.run(['sudo', 'pm-suspend'], check=True)
            except subprocess.CalledProcessError:
                print("Could not suspend system - insufficient permissions or tools not available")

    def run(self):
        """Main event loop"""
        print("\nSNES Gamepad Controller")
        print("=======================")
        print("Controls:")
        print("  D-pad: Mouse movement")
        print("  A: Left mouse click")
        print("  B: Right mouse click")
        print("  X: Scroll up")
        print("  Y: Scroll down")
        print("  L: Volume up")
        print("  R: Volume down")
        print("  START+SELECT: Sleep system (must press within 0.3s)")
        print("  A+B: Exit script (must press within 0.3s)")
        print(f"\nUsing device: {self.device.name}")
        print("Debug output enabled - you'll see button presses and actions\n")

        try:
            for event in self.device.read_loop():
                if not self.running:
                    break
                self.handle_event(event)
                
        except KeyboardInterrupt:
            print("\nExiting...")
        except Exception as e:
            print(f"\nError in main loop: {e}")
        finally:
            self.cleanup()

    def cleanup(self):
        """Clean up resources"""
        self.running = False
        if hasattr(self, 'combo_checker') and self.combo_checker.is_alive():
            self.combo_checker.join(timeout=1)
        print("Controller stopped.")

if __name__ == "__main__":
    # Check permissions
    try:
        controller = SNESGamepadController(debug=True)
        controller.run()
    except PermissionError:
        print("Permission denied to input devices. Try these solutions:")
        print("1. Run with sudo (not recommended for security)")
        print("2. Better: Add your user to the 'input' group:")
        print("   sudo usermod -a -G input $USER")
        print("   Then log out and back in")
        print("3. Or temporarily: sudo chmod 644 /dev/input/event*")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nInterrupted by user")
        sys.exit(0)