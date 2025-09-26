#!/home/student/Project/.venv/bin/python3
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
        self.paused = False
        self.controller_mode = False  # When True, disables mouse movement and clicks
        self.volume_paused = False  # When True, disables volume controls
        self.joystick = None
        self.mouse_sensitivity = 24
        self.volume_step = 5
        
        # Current mouse position tracking
        self.current_x = 640
        self.current_y = 360
        self.screen_width = 1920
        self.screen_height = 1080
        
        # Button state tracking
        self.button_states = {
            'A': {'pressed': False, 'time': 0, 'press_start': 0},
            'B': {'pressed': False, 'time': 0, 'press_start': 0},
            'X': {'pressed': False, 'time': 0, 'press_start': 0},
            'Y': {'pressed': False, 'time': 0, 'press_start': 0},
            'L': {'pressed': False, 'time': 0, 'press_start': 0},
            'R': {'pressed': False, 'time': 0, 'press_start': 0},
            'SELECT': {'pressed': False, 'time': 0, 'press_start': 0},
            'START': {'pressed': False, 'time': 0, 'press_start': 0}
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
        
        try:
            result = subprocess.run(['which', 'ydotool'], capture_output=True, timeout=2)
            if result.returncode != 0:
                print("ERROR: ydotool not found!")
                sys.exit(1)
                
            result = subprocess.run(['ydotool', 'mousemove', '0', '0'], 
                                  capture_output=True, text=True, timeout=2)
            if result.returncode != 0:
                print("ERROR: ydotool daemon not running!")
                sys.exit(1)
                
            if self.debug:
                print("✓ ydotool working correctly")
        except Exception as e:
            print(f"Error checking ydotool: {e}")
            sys.exit(1)

    def find_gamepad(self):
        """Find and initialize the gamepad device"""
        joystick_count = pygame.joystick.get_count()
        
        if joystick_count == 0:
            print("No joysticks/gamepads found!")
            sys.exit(1)
        
        print(f"Found {joystick_count} joystick(s):")
        for i in range(joystick_count):
            joystick = pygame.joystick.Joystick(i)
            joystick.init()
            print(f"  {i}: {joystick.get_name()}")
        
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
                
                if pressed:
                    self.button_states[button]['press_start'] = time.time()
                
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
                    self.paused = not self.paused
                    print(f"\n{'PAUSED' if self.paused else 'RESUMED'} (A+B Combo)")
                    self.button_states['A']['pressed'] = False
                    self.button_states['B']['pressed'] = False
                    time.sleep(0.5)
                
                # Check SELECT+START combo for controller mode toggle
                select_pressed = self.button_states['SELECT']['pressed']
                start_pressed = self.button_states['START']['pressed']
                select_time = self.button_states['SELECT']['time']
                start_time = self.button_states['START']['time']
                select_start = self.button_states['SELECT']['press_start']
                start_start = self.button_states['START']['press_start']
                
                if select_pressed and start_pressed and abs(select_time - start_time) < 0.3:
                    # Check if both buttons have been held for at least 1 second
                    hold_time_select = current_time - select_start
                    hold_time_start = current_time - start_start
                    
                    if hold_time_select >= 1.0 and hold_time_start >= 1.0:
                        self.controller_mode = not self.controller_mode
                        # Also pause volume controls when entering controller mode
                        self.volume_paused = self.controller_mode
                        mode_text = "CONTROLLER MODE" if self.controller_mode else "MOUSE MODE"
                        volume_text = " (Volume controls paused)" if self.volume_paused else " (Volume controls active)"
                        print(f"\n{mode_text}{volume_text} (SELECT+START held for 1s)")
                        self.button_states['SELECT']['pressed'] = False
                        self.button_states['START']['pressed'] = False
                        time.sleep(0.5)
                
                # L+R for Shutdown
                l_pressed = self.button_states['L']['pressed']
                r_pressed = self.button_states['R']['pressed']
                l_time = self.button_states['L']['time']
                r_time = self.button_states['R']['time']

                if l_pressed and r_pressed and abs(l_time - r_time) < 0.3:
                    print("\nL+R combo detected - shutting down system!")
                    self.system_sleep()
                    self.button_states['L']['pressed'] = False
                    self.button_states['R']['pressed'] = False
                    self.running = False
                    sys.exit(0)

    def handle_dpad(self, hat_x, hat_y):
        """Handle D-pad movement"""
        # Skip mouse movement if in controller mode or paused
        if self.controller_mode or self.paused:
            return
            
        current_time = time.time()
        self.dpad_state['x'] = hat_x
        self.dpad_state['y'] = -hat_y
        
        if current_time - self.last_dpad_move >= self.dpad_repeat_delay:
            if self.dpad_state['x'] != 0 or self.dpad_state['y'] != 0:
                move_x = self.dpad_state['x'] * self.mouse_sensitivity
                move_y = self.dpad_state['y'] * self.mouse_sensitivity
                self.move_mouse(move_x, move_y)
                self.last_dpad_move = current_time

    def handle_analog_stick(self, axis_x, axis_y):
        """Handle analog stick movement"""
        # Skip mouse movement if in controller mode or paused
        if self.controller_mode or self.paused:
            return
            
        current_time = time.time()
        deadzone = 0.3
        if abs(axis_x) < deadzone: axis_x = 0
        if abs(axis_y) < deadzone: axis_y = 0
            
        if (axis_x != 0 or axis_y != 0) and current_time - self.last_dpad_move >= self.dpad_repeat_delay:
            move_x = int(axis_x * self.mouse_sensitivity)
            move_y = int(axis_y * self.mouse_sensitivity)
            self.move_mouse(move_x, move_y)
            self.last_dpad_move = current_time

    def get_button_name(self, button_index):
        """Map button indices to SNES button names"""
        button_map = {
            0: 'X', 1: 'A', 2: 'B', 3: 'Y',
            4: 'L', 5: 'R', 6: 'SELECT', 7: 'START',
            8: 'SELECT', 9: 'START'  # Alternative mappings
        }
        return button_map.get(button_index, f'BTN{button_index}')

    def move_mouse(self, dx, dy):
        """Move mouse using ydotool"""
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
        # Skip mouse clicks if in controller mode or paused
        if self.controller_mode or self.paused:
            return False
            
        try:
            btn_codes = {
                'left': '0x00 0xC0',
                'right': '0x01 0xC0',
                'middle': '0x02 0xC0'
            }
            subprocess.run(['ydotool', 'click'] + btn_codes[button].split(),
                          timeout=1.0)
            return True
        except Exception as e:
            if self.debug:
                print(f"Click failed: {str(e)}")
            return False

    def mouse_button_down(self, button='left'):
        """Hold mouse button down"""
        # Skip mouse clicks if in controller mode or paused
        if self.controller_mode or self.paused:
            return False
            
        try:
            btn_codes = {
                'left': '0x00 0x40',
                'right': '0x01 0x40',
                'middle': '0x02 0x40'
            }
            subprocess.run(['ydotool', 'click'] + btn_codes[button].split(),
                          timeout=1.0)
            return True
        except Exception as e:
            if self.debug:
                print(f"Mouse button down failed: {str(e)}")
            return False

    def mouse_button_up(self, button='left'):
        """Release mouse button"""
        # Skip mouse clicks if in controller mode or paused
        if self.controller_mode or self.paused:
            return False
            
        try:
            btn_codes = {
                'left': '0x00 0x80',
                'right': '0x01 0x80',
                'middle': '0x02 0x80'
            }
            subprocess.run(['ydotool', 'click'] + btn_codes[button].split(),
                          timeout=1.0)
            return True
        except Exception as e:
            if self.debug:
                print(f"Mouse button up failed: {str(e)}")
            return False

    def adjust_volume(self, percent):
        """Adjust system volume using amixer"""
        # Skip volume adjustment if volume controls are paused or paused
        if self.volume_paused or self.paused:
            if self.debug:
                print("Volume controls are paused")
            return
            
        try:
            direction = "+" if percent > 0 else "-"
            cmd = ['amixer', '-q', 'set', 'Master', f'{abs(percent)}%{direction}']
            subprocess.run(cmd, check=True, timeout=1)
            
            result = subprocess.run(['amixer', 'get', 'Master'],
                                 capture_output=True, text=True, check=True, timeout=1)
            
            # Extract volume percentage
            for line in result.stdout.split('\n'):
                if '[' in line and '%' in line:
                    try:
                        start = line.find('[') + 1
                        end = line.find('%', start)
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
            print("Putting system to down...")
            subprocess.Popen(["sudo", "poweroff"], 
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL)
        except Exception as e:
            print(f"Could not suspend system: {e}")

    def run(self):
        """Main event loop"""
        print("\nSNES Gamepad Controller - ydotool Only")
        print("======================================")
        print("Controls:")
        print("  D-pad/Left stick: Mouse movement (disabled in controller/pause mode)")
        print("  A: Left mouse click (disabled in controller/pause mode)")
        print("  B: Right mouse button (hold for drag/scroll) (disabled in controller/pause mode)") 
        print("  L+R: Shutdown system (within 0.3s)")
        print("  SELECT: Volume down (if held < 1s, disabled in controller/pause mode)")
        print("  START: Volume up (if held < 1s, disabled in controller/pause mode)")
        print("  SELECT+START (held 1s): Toggle controller/mouse mode + volume controls")
        print("  A+B: Toggle pause/resume (within 0.3s)")
        print(f"\nUsing gamepad: {self.joystick.get_name()}")
        print("Debug output enabled")
        print("Starting in MOUSE MODE with volume controls active\n")

        clock = pygame.time.Clock()
        
        try:
            while self.running:
                for event in pygame.event.get():
                    if event.type == pygame.QUIT:
                        self.running = False
                        break
                    
                    elif event.type == pygame.JOYBUTTONDOWN:
                        button_name = self.get_button_name(event.button)
                        self.update_button_state(button_name, True)
                        
                        # Debug: Print button index and name
                        if self.debug:
                            print(f"Button pressed: Index {event.button} -> {button_name}")
                        
                        if not self.paused:  # Only process these actions if not paused
                            if button_name == 'A':
                                self.mouse_click('left')
                            elif button_name == 'B':
                                self.mouse_button_down('right')
                            # X and Y buttons no longer perform any actions
                    
                    elif event.type == pygame.JOYBUTTONUP:
                        button_name = self.get_button_name(event.button)
                        
                        # Debug: Print button index and name
                        if self.debug:
                            print(f"Button released: Index {event.button} -> {button_name}")
                        
                        # Calculate hold time
                        with self.button_lock:
                            if button_name in self.button_states:
                                hold_time = time.time() - self.button_states[button_name]['press_start']
                                
                                # Handle volume controls for SELECT and START
                                if button_name == 'SELECT' and hold_time < 1.0 and not self.paused:
                                    self.adjust_volume(-self.volume_step)
                                elif button_name == 'START' and hold_time < 1.0 and not self.paused:
                                    self.adjust_volume(self.volume_step)
                        
                        self.update_button_state(button_name, False)
                        
                        if button_name == 'B':
                            self.mouse_button_up('right')
                    
                    elif event.type == pygame.JOYHATMOTION:
                        if not self.paused:  # Only process movement if not paused
                            hat_x, hat_y = event.value
                            self.handle_dpad(hat_x, hat_y)
                
                # Check analog sticks
                if not self.paused and self.joystick.get_numaxes() >= 2:
                    axis_x = self.joystick.get_axis(0)
                    axis_y = self.joystick.get_axis(1)
                    self.handle_analog_stick(axis_x, axis_y)
                
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