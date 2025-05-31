import pygame
import time
import subprocess
import sys
import os
from threading import Lock, Thread

class SNESGamepadController:
    def __init__(self, debug=True):
        self.debug = debug
        self.running = True
        self.paused = False  # Add pause state
        self.joystick = None
        self.mouse_sensitivity = 8
        self.volume_step = 5
        
        # Current mouse position tracking
        self.current_x = 640  # Default starting position
        self.current_y = 360
        self.screen_width = 1920
        self.screen_height = 1080
        
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
        self.dpad_repeat_delay = 0.05
        
        # Initialize components
        self.initialize_pygame()
        self.check_ydotool()
        self.find_gamepad()
        
        # Start combo checking thread
        self.combo_checker = Thread(target=self.check_combos)
        self.combo_checker.daemon = True
        self.combo_checker.start()

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

    def check_ydotool(self):
        """Check if ydotool is available and working"""
        if self.debug:
            print("Checking ydotool...")
        
        # Check if ydotool is installed
        try:
            result = subprocess.run(['which', 'ydotool'], capture_output=True, timeout=2)
            if result.returncode != 0:
                print("ERROR: ydotool not found!")
                print("Install with: sudo pacman -S ydotool  (Arch)")
                print("             sudo apt install ydotool   (Ubuntu/Debian)")
                sys.exit(1)
        except Exception as e:
            print(f"Error checking ydotool: {e}")
            sys.exit(1)
        
        # Test basic functionality
        try:
            result = subprocess.run(['ydotool', 'mousemove', '0', '0'], 
                                  capture_output=True, text=True, timeout=2)
            if result.returncode == 0:
                if self.debug:
                    print("✓ ydotool working correctly")
            else:
                print("ERROR: ydotool daemon not running!")
                print("Start daemon with: sudo ydotoold")
                print("Or add yourself to input group and reboot")
                sys.exit(1)
        except Exception as e:
            print(f"Error testing ydotool: {e}")
            print("Make sure ydotool daemon is running: sudo ydotoold")
            sys.exit(1)

    def find_gamepad(self):
        """Find and initialize the gamepad device"""
        joystick_count = pygame.joystick.get_count()
        
        if joystick_count == 0:
            print("No joysticks/gamepads found!")
            print("Make sure your gamepad is connected and recognized by the system.")
            sys.exit(1)
        
        print(f"Found {joystick_count} joystick(s):")
        for i in range(joystick_count):
            joystick = pygame.joystick.Joystick(i)
            joystick.init()
            print(f"  {i}: {joystick.get_name()}")
            print(f"     Buttons: {joystick.get_numbuttons()}")
            print(f"     Axes: {joystick.get_numaxes()}")
            print(f"     Hats: {joystick.get_numhats()}")
        
        # Use the first joystick
        self.joystick = pygame.joystick.Joystick(0)
        self.joystick.init()
        
        if self.debug:
            print(f"\nUsing gamepad: {self.joystick.get_name()}")

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
            time.sleep(0.1)
            
            with self.button_lock:
                current_time = time.time()
                
                # Check A+B combo (toggle pause)
                a_pressed = self.button_states['A']['pressed']
                b_pressed = self.button_states['B']['pressed']
                a_time = self.button_states['A']['time']
                b_time = self.button_states['B']['time']
                
                if a_pressed and b_pressed and abs(a_time - b_time) < 0.3:
                    self.paused = not self.paused  # Toggle pause state
                    print(f"\n{'PAUSED' if self.paused else 'RESUMED'} (A+B Combo)")
                    # Reset button states to avoid rapid toggling
                    self.button_states['A']['pressed'] = False
                    self.button_states['B']['pressed'] = False
                    time.sleep(0.5)  # Debounce
                
                # Check START+SELECT combo
                start_pressed = self.button_states['START']['pressed']
                select_pressed = self.button_states['SELECT']['pressed']
                start_time = self.button_states['START']['time']
                select_time = self.button_states['SELECT']['time']
                
                if start_pressed and select_pressed and abs(start_time - select_time) < 0.3:
                    print("\nSTART+SELECT combo detected - sleeping system!")
                    self.system_sleep()
                    self.button_states['START']['pressed'] = False
                    self.button_states['SELECT']['pressed'] = False

    def handle_dpad(self, hat_x, hat_y):
        """Handle D-pad movement"""
        current_time = time.time()
        
        self.dpad_state['x'] = hat_x
        self.dpad_state['y'] = -hat_y  # Invert Y for natural movement
        
        if current_time - self.last_dpad_move >= self.dpad_repeat_delay:
            if self.dpad_state['x'] != 0 or self.dpad_state['y'] != 0:
                move_x = self.dpad_state['x'] * self.mouse_sensitivity
                move_y = self.dpad_state['y'] * self.mouse_sensitivity
                self.move_mouse(move_x, move_y)
                self.last_dpad_move = current_time

    def handle_analog_stick(self, axis_x, axis_y):
        """Handle analog stick movement"""
        current_time = time.time()
        
        # Apply deadzone
        deadzone = 0.3
        if abs(axis_x) < deadzone:
            axis_x = 0
        if abs(axis_y) < deadzone:
            axis_y = 0
            
        if (axis_x != 0 or axis_y != 0) and current_time - self.last_dpad_move >= self.dpad_repeat_delay:
            move_x = int(axis_x * self.mouse_sensitivity)
            move_y = int(axis_y * self.mouse_sensitivity)
            self.move_mouse(move_x, move_y)
            self.last_dpad_move = current_time

    def get_button_name(self, button_index):
        """Map button indices to SNES button names"""
        button_map = {
            0: 'X',      1: 'A',      2: 'B',      3: 'Y',
            4: 'L',      5: 'R',      6: 'SELECT', 7: 'START'
        }
        return button_map.get(button_index, f'BTN{button_index}')

    def move_mouse(self, dx, dy):
        """Move mouse using ydotool"""
        # Update internal position
        self.current_x = max(0, min(self.current_x + dx, self.screen_width - 1))
        self.current_y = max(0, min(self.current_y + dy, self.screen_height - 1))
        
        try:
            subprocess.run(['ydotool', 'mousemove', '--', str(dx), str(dy)], 
                          capture_output=True, timeout=0.5)
            if self.debug:
                print(f"Mouse moved: ({dx}, {dy})")
        except Exception as e:
            if self.debug:
                print(f"ydotool move failed: {e}")

    def mouse_click(self, button='left'):
        """Mouse click using ydotool"""
        try:
            # Hex button codes with down+up flags (0x40 + 0x80 = 0xC0)
            btn_codes = {
                'left': '0x00 0xC0',    # Left click (down+up)
                'right': '0x01 0xC0',   # Right click (down+up)
                'middle': '0x02 0xC0'   # Middle click
            }
            
            cmd = ['ydotool', 'click'] + btn_codes[button].split()
            
            if self.debug:
                print(f"Executing: {' '.join(cmd)}")
            
            result = subprocess.run(cmd, 
                                capture_output=True, 
                                timeout=1.0, 
                                text=True)
            
            if result.returncode != 0:
                raise RuntimeError(f"ydotool failed: {result.stderr}")
                
            return True
            
        except Exception as e:
            if self.debug:
                print(f"Click failed: {str(e)}")
            return False

    def press_key(self, key):
        """Press a keyboard key using ydotool"""
        try:
            # Use ydotool type for simple key presses
            subprocess.run(['ydotool', 'type', key], 
                          capture_output=True, timeout=0.5)
            if self.debug:
                print(f"Key pressed: {key}")
        except Exception as e:
            if self.debug:
                print(f"Key press failed: {e}")

    def mouse_button_down(self, button='left'):
        """Hold mouse button down using ydotool"""
        try:
            btn_codes = {
                'left': '0x00 0x40',    # Left button down
                'right': '0x01 0x40',   # Right button down
                'middle': '0x02 0x40'   # Middle button down
            }
            
            cmd = ['ydotool', 'click'] + btn_codes[button].split()
            
            if self.debug:
                print(f"Mouse {button} button down: {' '.join(cmd)}")
            
            result = subprocess.run(cmd, 
                                capture_output=True, 
                                timeout=1.0, 
                                text=True)
            
            if result.returncode != 0:
                raise RuntimeError(f"ydotool failed: {result.stderr}")
                
            return True
            
        except Exception as e:
            if self.debug:
                print(f"Mouse button down failed: {str(e)}")
            return False

    def mouse_button_up(self, button='left'):
        """Release mouse button using ydotool"""
        try:
            btn_codes = {
                'left': '0x00 0x80',    # Left button up
                'right': '0x01 0x80',   # Right button up
                'middle': '0x02 0x80'   # Middle button up
            }
            
            cmd = ['ydotool', 'click'] + btn_codes[button].split()
            
            if self.debug:
                print(f"Mouse {button} button up: {' '.join(cmd)}")
            
            result = subprocess.run(cmd, 
                                capture_output=True, 
                                timeout=1.0, 
                                text=True)
            
            if result.returncode != 0:
                raise RuntimeError(f"ydotool failed: {result.stderr}")
                
            return True
            
        except Exception as e:
            if self.debug:
                print(f"Mouse button up failed: {str(e)}")
            return False

    def adjust_volume(self, percent):
        """Adjust system volume using amixer"""
        try:
            direction = "+" if percent > 0 else "-"
            cmd = ['amixer', '-q', 'set', 'Master', f'{abs(percent)}%{direction}']
            subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=1)
            
            # Get current volume for feedback
            result = subprocess.run(['amixer', 'get', 'Master'],
                                   capture_output=True, text=True, check=True, timeout=1)
            
            lines = result.stdout.split('\n')
            for line in lines:
                if '[' in line and '%' in line and ('Front Left:' in line or 'Mono:' in line):
                    try:
                        start = line.find('[') + 1
                        end = line.find('%', start)
                        if start > 0 and end > start:
                            volume = line[start:end]
                            print(f"Volume: {volume}%")
                            return
                    except:
                        pass
            
            print(f"Volume {'up' if percent > 0 else 'down'} {abs(percent)}%")
                            
        except Exception as e:
            if self.debug:
                print(f"Volume adjustment failed: {e}")

    def system_sleep(self):
        """Put system to sleep"""
        try:
            print("Putting system to sleep...")
            subprocess.run(['systemctl', 'suspend'], check=True, timeout=5)
        except Exception as e:
            print(f"Could not suspend system: {e}")

    def run(self):
        """Main event loop"""
        print("\nSNES Gamepad Controller - ydotool Only")
        print("======================================")
        print("Controls:")
        print("  D-pad/Left stick: Mouse movement")
        print("  A: Left mouse click")
        print("  B: Right mouse button (hold for drag/scroll)") 
        print("  X: Press 'j' key")
        print("  Y: Press 'l' key")
        print("  L: Volume up")
        print("  R: Volume down")
        print("  START+SELECT: Sleep system (within 0.3s)")
        print("  A+B: Toggle pause/resume (within 0.3s)")
        print(f"\nUsing gamepad: {self.joystick.get_name()}")
        print("Debug output enabled\n")

        clock = pygame.time.Clock()
        
        try:
            while self.running:
                if not self.paused:  # Only process events if NOT paused
                    for event in pygame.event.get():
                        if event.type == pygame.QUIT:
                            self.running = False
                            break
                        
                        elif event.type == pygame.JOYBUTTONDOWN:
                            button_name = self.get_button_name(event.button)
                            self.update_button_state(button_name, True)
                            
                            if button_name == 'A':
                                self.mouse_click('left')
                            elif button_name == 'B':
                                self.mouse_button_down('right')
                            elif button_name == 'X':
                                self.press_key('j')
                            elif button_name == 'Y':
                                self.press_key('l')
                            elif button_name == 'L':
                                self.adjust_volume(self.volume_step)
                            elif button_name == 'R':
                                self.adjust_volume(-self.volume_step)
                        
                        elif event.type == pygame.JOYBUTTONUP:
                            button_name = self.get_button_name(event.button)
                            self.update_button_state(button_name, False)
                            
                            # Release right mouse button when B is released
                            if button_name == 'B':
                                self.mouse_button_up('right')
                        
                        elif event.type == pygame.JOYHATMOTION:
                            hat_x, hat_y = event.value
                            self.handle_dpad(hat_x, hat_y)
                    
                    # Check analog sticks (only if not paused)
                    if self.joystick.get_numaxes() >= 2:
                        axis_x = self.joystick.get_axis(0)
                        axis_y = self.joystick.get_axis(1)
                        self.handle_analog_stick(axis_x, axis_y)
                else:
                    # Still process pygame events (to detect unpause)
                    for event in pygame.event.get():
                        if event.type == pygame.JOYBUTTONDOWN or event.type == pygame.JOYBUTTONUP:
                            button_name = self.get_button_name(event.button)
                            self.update_button_state(button_name, event.type == pygame.JOYBUTTONDOWN)
                    
                    time.sleep(0.1)  # Reduce CPU usage while paused
                
                clock.tick(60)
                
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
        if self.joystick:
            self.joystick.quit()
        pygame.quit()
        print("Controller stopped.")

if __name__ == "__main__":
    try:
        controller = SNESGamepadController(debug=True)
        controller.run()
    except KeyboardInterrupt:
        print("\nInterrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
        