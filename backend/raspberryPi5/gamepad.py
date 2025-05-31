#!/usr/bin/env python3

import pygame
import pyautogui
import time
import subprocess
import sys
from threading import Lock, Thread
import threading

class SNESGamepadController:
    def __init__(self, debug=True):
        self.debug = debug
        self.running = True
        self.joystick = None
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
        self.dpad_repeat_delay = 0.05  # Delay for smoother mouse movement
        
        # Initialize pygame and pyautogui
        self.initialize_pygame()
        self.initialize_pyautogui()
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

    def initialize_pyautogui(self):
        """Initialize pyautogui for mouse control"""
        try:
            # Configure pyautogui
            pyautogui.FAILSAFE = True  # Move mouse to corner to stop
            pyautogui.PAUSE = 0.01     # Small pause between actions
            
            # Get screen size
            self.screen_width, self.screen_height = pyautogui.size()
            if self.debug:
                print(f"PyAutoGUI initialized - Screen size: {self.screen_width}x{self.screen_height}")
                
        except Exception as e:
            print(f"Failed to initialize pyautogui: {e}")
            print("Install pyautogui with: pip install pyautogui")
            print("On Linux, you may also need: sudo apt-get install python3-tk python3-dev")
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
            print(f"Buttons: {self.joystick.get_numbuttons()}")
            print(f"Axes: {self.joystick.get_numaxes()}")
            print(f"Hats (D-pads): {self.joystick.get_numhats()}")

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

    def handle_dpad(self, hat_x, hat_y):
        """Handle D-pad movement using hat input"""
        current_time = time.time()
        
        # Update D-pad state
        self.dpad_state['x'] = hat_x
        self.dpad_state['y'] = -hat_y  # Invert Y axis for natural mouse movement
        
        # Only move mouse if enough time has passed (for smoother movement)
        if current_time - self.last_dpad_move >= self.dpad_repeat_delay:
            if self.dpad_state['x'] != 0 or self.dpad_state['y'] != 0:
                move_x = self.dpad_state['x'] * self.mouse_sensitivity
                move_y = self.dpad_state['y'] * self.mouse_sensitivity
                self.move_mouse(move_x, move_y)
                self.last_dpad_move = current_time
                
                if self.debug:
                    print(f"D-pad move: ({move_x}, {move_y})")

    def handle_analog_stick(self, axis_x, axis_y):
        """Handle analog stick movement as alternative to D-pad"""
        current_time = time.time()
        
        # Apply deadzone
        deadzone = 0.3
        if abs(axis_x) < deadzone:
            axis_x = 0
        if abs(axis_y) < deadzone:
            axis_y = 0
            
        # Only move if axes are active and enough time has passed
        if (axis_x != 0 or axis_y != 0) and current_time - self.last_dpad_move >= self.dpad_repeat_delay:
            move_x = int(axis_x * self.mouse_sensitivity)
            move_y = int(axis_y * self.mouse_sensitivity)
            self.move_mouse(move_x, move_y)
            self.last_dpad_move = current_time
            
            if self.debug:
                print(f"Analog stick move: ({move_x}, {move_y})")

    def get_button_name(self, button_index):
        """Map button indices to SNES button names"""
        # This mapping might need adjustment based on your specific controller
        # Common SNES USB controller mappings:
        button_map = {
            0: 'X',      # Often the first button
            1: 'A',      # Second button  
            2: 'B',      # Third button
            3: 'Y',      # Fourth button
            4: 'L',      # Left shoulder
            5: 'R',      # Right shoulder
            6: 'SELECT', # Select button
            7: 'START'   # Start button
        }
        return button_map.get(button_index, f'BTN{button_index}')

    def move_mouse(self, dx, dy):
        """Move mouse pointer using pyautogui"""
        try:
            current_x, current_y = pyautogui.position()
            new_x = current_x + dx
            new_y = current_y + dy
            
            # Clamp to screen bounds
            new_x = max(0, min(new_x, self.screen_width - 1))
            new_y = max(0, min(new_y, self.screen_height - 1))
            
            pyautogui.moveTo(new_x, new_y)
            
            if self.debug:
                print(f"Mouse moved to: ({new_x}, {new_y})")
                
        except Exception as e:
            if self.debug:
                print(f"Mouse move failed: {e}")

    def mouse_click(self, button='left'):
        """Simulate mouse click using pyautogui"""
        try:
            pyautogui.click(button=button)
            if self.debug:
                print(f"Mouse {button} click")
        except Exception as e:
            if self.debug:
                print(f"Mouse click failed: {e}")

    def scroll(self, amount):
        """Simulate mouse wheel scroll using pyautogui"""
        try:
            pyautogui.scroll(amount)
            if self.debug:
                direction = 'up' if amount > 0 else 'down'
                print(f"Scroll {direction} ({abs(amount)} steps)")
        except Exception as e:
            if self.debug:
                print(f"Scroll failed: {e}")

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
                            print(f"Volume set to: {volume}%")
                            return
                    except:
                        pass
            
            print(f"Volume {'increased' if percent > 0 else 'decreased'} by {abs(percent)}%")
                            
        except subprocess.CalledProcessError as e:
            if self.debug:
                print(f"Volume adjustment failed: {e}")
        except (FileNotFoundError, subprocess.TimeoutExpired):
            if self.debug:
                print("amixer not found or timed out - install alsa-utils")

    def system_sleep(self):
        """Put system to sleep"""
        try:
            print("Putting system to sleep...")
            subprocess.run(['systemctl', 'suspend'], check=True, timeout=5)
        except subprocess.CalledProcessError as e:
            if self.debug:
                print(f"Sleep failed with systemctl: {e}")
            try:
                subprocess.run(['sudo', 'pm-suspend'], check=True, timeout=5)
            except subprocess.CalledProcessError as e:
                print(f"Could not suspend system: {e}")
            except FileNotFoundError:
                print("Could not suspend system - pm-suspend not found")
        except FileNotFoundError:
            print("systemctl not found - trying pm-suspend")
            try:
                subprocess.run(['sudo', 'pm-suspend'], check=True, timeout=5)
            except (subprocess.CalledProcessError, FileNotFoundError) as e:
                print(f"Could not suspend system: {e}")
        except subprocess.TimeoutExpired:
            print("System suspend command timed out")

    def run(self):
        """Main event loop"""
        print("\nSNES Gamepad Controller (pygame/pyautogui)")
        print("==========================================")
        print("Controls:")
        print("  D-pad/Left stick: Mouse movement")
        print("  A: Left mouse click")
        print("  B: Right mouse click") 
        print("  X: Scroll up")
        print("  Y: Scroll down")
        print("  L: Volume up")
        print("  R: Volume down")
        print("  START+SELECT: Sleep system (within 0.3s)")
        print("  A+B: Exit script (within 0.3s)")
        print(f"\nUsing gamepad: {self.joystick.get_name()}")
        print("Debug output enabled\n")

        clock = pygame.time.Clock()
        
        try:
            while self.running:
                # Process pygame events
                for event in pygame.event.get():
                    if event.type == pygame.QUIT:
                        self.running = False
                        break
                    
                    elif event.type == pygame.JOYBUTTONDOWN:
                        button_name = self.get_button_name(event.button)
                        self.update_button_state(button_name, True)
                        
                        # Handle single button actions
                        if button_name == 'A':
                            self.mouse_click('left')
                        elif button_name == 'B':
                            self.mouse_click('right')
                        elif button_name == 'X':
                            self.scroll(self.scroll_sensitivity)
                        elif button_name == 'Y':
                            self.scroll(-self.scroll_sensitivity)
                        elif button_name == 'L':
                            self.adjust_volume(self.volume_step)
                        elif button_name == 'R':
                            self.adjust_volume(-self.volume_step)
                    
                    elif event.type == pygame.JOYBUTTONUP:
                        button_name = self.get_button_name(event.button)
                        self.update_button_state(button_name, False)
                    
                    elif event.type == pygame.JOYHATMOTION:
                        # Handle D-pad
                        hat_x, hat_y = event.value
                        self.handle_dpad(hat_x, hat_y)
                
                # Also check analog sticks continuously
                if self.joystick.get_numaxes() >= 2:
                    axis_x = self.joystick.get_axis(0)  # Left stick X
                    axis_y = self.joystick.get_axis(1)  # Left stick Y
                    self.handle_analog_stick(axis_x, axis_y)
                
                # Limit to 60 FPS
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