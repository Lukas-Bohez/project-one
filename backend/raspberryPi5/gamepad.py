#!/usr/bin/env python3
import evdev
from evdev import ecodes, InputDevice
import subprocess
import time
import sys
import os
from pathlib import Path

# Mouse movement speed (higher = faster)
MOUSE_SPEED = 10
SCROLL_SPEED = 3

# Virtual input device paths
UINPUT_PATH = "/dev/uinput"
MOUSE_DEVICE = None

def setup_virtual_mouse():
    """Create a virtual mouse device using direct uinput interface"""
    try:
        # Create virtual mouse device
        mouse_fd = os.open(UINPUT_PATH, os.O_WRONLY | os.O_NONBLOCK)
        
        # Enable mouse events
        import fcntl
        
        # Mouse buttons
        fcntl.ioctl(mouse_fd, 0x40045564, 0x001)  # EV_KEY
        fcntl.ioctl(mouse_fd, 0x40045565, 0x110)  # BTN_LEFT
        fcntl.ioctl(mouse_fd, 0x40045565, 0x111)  # BTN_RIGHT
        
        # Mouse movement
        fcntl.ioctl(mouse_fd, 0x40045564, 0x002)  # EV_REL
        fcntl.ioctl(mouse_fd, 0x40045566, 0x000)  # REL_X
        fcntl.ioctl(mouse_fd, 0x40045566, 0x001)  # REL_Y
        fcntl.ioctl(mouse_fd, 0x40045566, 0x008)  # REL_WHEEL
        
        # Create the device
        device_info = bytearray(1116)  # sizeof(struct uinput_user_dev)
        device_info[:80] = b"Virtual Gamepad Mouse\0"  # name
        
        os.write(mouse_fd, device_info)
        fcntl.ioctl(mouse_fd, 0x5501)  # UI_DEV_CREATE
        
        return mouse_fd
    except Exception as e:
        print(f"Failed to create virtual mouse: {e}")
        return None

def emit_event(fd, type_code, code, value):
    """Emit an input event"""
    if fd is None:
        return
    try:
        # Create input_event structure: time(16 bytes) + type(2) + code(2) + value(4) = 24 bytes
        import struct
        import time as time_mod
        
        tv_sec = int(time_mod.time())
        tv_usec = int((time_mod.time() % 1) * 1000000)
        
        event = struct.pack('LLHHH', tv_sec, tv_usec, type_code, code, value)
        os.write(fd, event)
        
        # Send sync event
        sync_event = struct.pack('LLHHH', tv_sec, tv_usec, 0, 0, 0)  # EV_SYN
        os.write(fd, sync_event)
    except Exception as e:
        print(f"Failed to emit event: {e}")

def alternative_mouse_control(action, value=0):
    """Alternative mouse control using xdotool (fallback method)"""
    try:
        if action == "move_left":
            subprocess.run(["xdotool", "mousemove_relative", "--", f"-{MOUSE_SPEED}", "0"], 
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif action == "move_right":
            subprocess.run(["xdotool", "mousemove_relative", f"{MOUSE_SPEED}", "0"], 
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif action == "move_up":
            subprocess.run(["xdotool", "mousemove_relative", "--", "0", f"-{MOUSE_SPEED}"], 
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif action == "move_down":
            subprocess.run(["xdotool", "mousemove_relative", "0", f"{MOUSE_SPEED}"], 
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif action == "click_left":
            if value:
                subprocess.run(["xdotool", "mousedown", "1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                subprocess.run(["xdotool", "mouseup", "1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif action == "click_right":
            if value:
                subprocess.run(["xdotool", "mousedown", "3"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                subprocess.run(["xdotool", "mouseup", "3"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif action == "scroll_up":
            subprocess.run(["xdotool", "click", "4"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif action == "scroll_down":
            subprocess.run(["xdotool", "click", "5"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass  # Silently fail if xdotool is not available

def find_gamepad():
    """Find the gamepad device"""
    devices = [InputDevice(path) for path in evdev.list_devices()]
    for device in devices:
        name_lower = device.name.lower()
        if any(keyword in name_lower for keyword in ["gamepad", "joystick", "controller", "xbox", "playstation", "8bitdo"]):
            print(f"Found gamepad: {device.name} at {device.path}")
            return device
    return None

def setup_environment():
    """Setup the environment for uinput access"""
    print("Setting up environment...")
    
    # Load uinput module if not loaded
    try:
        result = subprocess.run(["lsmod"], capture_output=True, text=True)
        if "uinput" not in result.stdout:
            print("Loading uinput module...")
            subprocess.run(["sudo", "modprobe", "uinput"], check=True)
    except Exception as e:
        print(f"Warning: Could not load uinput module: {e}")
    
    # Check if uinput device exists and is accessible
    if not os.path.exists(UINPUT_PATH):
        print(f"Error: {UINPUT_PATH} does not exist")
        return False
    
    # Try to access the device
    try:
        test_fd = os.open(UINPUT_PATH, os.O_WRONLY | os.O_NONBLOCK)
        os.close(test_fd)
        return True
    except PermissionError:
        print("Permission denied accessing uinput. Trying to fix permissions...")
        try:
            subprocess.run(["sudo", "chmod", "666", UINPUT_PATH], check=True)
            return True
        except Exception as e:
            print(f"Could not fix permissions: {e}")
            return False
    except Exception as e:
        print(f"Error accessing uinput: {e}")
        return False

def main():
    print("Gamepad Mouse Controller v2.0")
    print("=============================")
    
    # Check if running as root
    if os.geteuid() != 0:
        print("Warning: Not running as root. You may need to run with sudo for full functionality.")
    
    # Setup environment
    if not setup_environment():
        print("Warning: uinput setup failed. Falling back to xdotool method.")
        print("Installing xdotool if not present...")
        try:
            subprocess.run(["sudo", "apt", "update"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(["sudo", "apt", "install", "-y", "xdotool"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass
    
    print("Looking for gamepad...")
    gamepad = None
    
    while gamepad is None:
        gamepad = find_gamepad()
        if gamepad is None:
            print("Gamepad not found. Please connect it and try again.")
            time.sleep(2)
    
    # Try to setup virtual mouse
    mouse_fd = setup_virtual_mouse()
    use_xdotool = mouse_fd is None
    
    if use_xdotool:
        print("Using xdotool for mouse control (fallback method)")
    else:
        print("Using direct uinput for mouse control")
    
    print("\nGamepad connected. Starting controller...")
    print("Controls:")
    print("  D-pad: Mouse movement")
    print("  Left Bumper/Trigger: Left mouse button")
    print("  Right Bumper/Trigger: Right mouse button")
    print("  Y button: Scroll up")
    print("  X button: Scroll down")
    print("  A button: Volume up")
    print("  B button: Volume down")
    print("  START + SELECT: Sleep/Wake system")
    print("  A + B: Exit script")
    print()
    
    # Track button states
    btn_state = {
        'dpad_x': 0,
        'dpad_y': 0,
        'left_bumper': False,
        'right_bumper': False,
        'x': False,
        'y': False,
        'a': False,
        'b': False,
        'start': False,
        'select': False,
        'was_asleep': False,
    }
    
    try:
        for event in gamepad.read_loop():
            if event.type == ecodes.EV_KEY:
                # Handle button presses
                if event.code in [ecodes.BTN_TL, ecodes.BTN_TL2]:  # Left bumper/trigger
                    if not btn_state['was_asleep']:
                        btn_state['left_bumper'] = bool(event.value)
                        if use_xdotool:
                            alternative_mouse_control("click_left", event.value)
                        else:
                            emit_event(mouse_fd, 1, 0x110, event.value)  # BTN_LEFT
                
                elif event.code in [ecodes.BTN_TR, ecodes.BTN_TR2]:  # Right bumper/trigger
                    if not btn_state['was_asleep']:
                        btn_state['right_bumper'] = bool(event.value)
                        if use_xdotool:
                            alternative_mouse_control("click_right", event.value)
                        else:
                            emit_event(mouse_fd, 1, 0x111, event.value)  # BTN_RIGHT
                
                elif event.code == ecodes.BTN_NORTH:  # Y button - scroll up
                    if not btn_state['was_asleep']:
                        btn_state['y'] = bool(event.value)
                        if event.value:
                            if use_xdotool:
                                alternative_mouse_control("scroll_up")
                            else:
                                emit_event(mouse_fd, 2, 8, SCROLL_SPEED)  # REL_WHEEL
                
                elif event.code == ecodes.BTN_WEST:  # X button - scroll down
                    if not btn_state['was_asleep']:
                        btn_state['x'] = bool(event.value)
                        if event.value:
                            if use_xdotool:
                                alternative_mouse_control("scroll_down")
                            else:
                                emit_event(mouse_fd, 2, 8, -SCROLL_SPEED)  # REL_WHEEL
                
                elif event.code == ecodes.BTN_SOUTH:  # A button - volume up
                    btn_state['a'] = bool(event.value)
                    if event.value and not btn_state['was_asleep']:
                        try:
                            subprocess.run(["amixer", "set", "Master", "5%+"], 
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        except Exception:
                            pass
                
                elif event.code == ecodes.BTN_EAST:  # B button - volume down
                    btn_state['b'] = bool(event.value)
                    if event.value and not btn_state['was_asleep']:
                        try:
                            subprocess.run(["amixer", "set", "Master", "5%-"], 
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        except Exception:
                            pass
                
                # Check for A+B exit combo
                if btn_state['a'] and btn_state['b']:
                    print("A + B pressed. Exiting script...")
                    break
                
                elif event.code == ecodes.BTN_START:
                    btn_state['start'] = bool(event.value)
                    if event.value and btn_state['select']:
                        if btn_state['was_asleep']:
                            print("Waking up from sleep...")
                            btn_state['was_asleep'] = False
                        else:
                            print("Going to sleep...")
                            try:
                                subprocess.run(["sudo", "systemctl", "suspend"])
                            except Exception as e:
                                print(f"Could not suspend system: {e}")
                            btn_state['was_asleep'] = True
                
                elif event.code == ecodes.BTN_SELECT:
                    btn_state['select'] = bool(event.value)
                    if event.value and btn_state['start']:
                        if btn_state['was_asleep']:
                            print("Waking up from sleep...")
                            btn_state['was_asleep'] = False
                        else:
                            print("Going to sleep...")
                            try:
                                subprocess.run(["sudo", "systemctl", "suspend"])
                            except Exception as e:
                                print(f"Could not suspend system: {e}")
                            btn_state['was_asleep'] = True
            
            elif event.type == ecodes.EV_ABS and not btn_state['was_asleep']:
                # Handle D-pad movement
                if event.code in [ecodes.ABS_X, ecodes.ABS_HAT0X]:
                    old_x = btn_state['dpad_x']
                    btn_state['dpad_x'] = event.value
                    
                    # Handle movement based on value change
                    if old_x != event.value:
                        if event.value < 0 or event.value == 0:  # Left
                            if use_xdotool:
                                alternative_mouse_control("move_left")
                            else:
                                emit_event(mouse_fd, 2, 0, -MOUSE_SPEED)  # REL_X
                        elif event.value > 0 or event.value == 255:  # Right
                            if use_xdotool:
                                alternative_mouse_control("move_right")
                            else:
                                emit_event(mouse_fd, 2, 0, MOUSE_SPEED)  # REL_X
                
                elif event.code in [ecodes.ABS_Y, ecodes.ABS_HAT0Y]:
                    old_y = btn_state['dpad_y']
                    btn_state['dpad_y'] = event.value
                    
                    # Handle movement based on value change
                    if old_y != event.value:
                        if event.value < 0 or event.value == 0:  # Up
                            if use_xdotool:
                                alternative_mouse_control("move_up")
                            else:
                                emit_event(mouse_fd, 2, 1, -MOUSE_SPEED)  # REL_Y
                        elif event.value > 0 or event.value == 255:  # Down
                            if use_xdotool:
                                alternative_mouse_control("move_down")
                            else:
                                emit_event(mouse_fd, 2, 1, MOUSE_SPEED)  # REL_Y
    
    except KeyboardInterrupt:
        print("\nExiting...")
    except Exception as e:
        print(f"Error: {e}")
        print("Gamepad may have been disconnected.")
    finally:
        # Clean up
        if mouse_fd is not None:
            try:
                import fcntl
                fcntl.ioctl(mouse_fd, 0x5502)  # UI_DEV_DESTROY
                os.close(mouse_fd)
            except Exception:
                pass
        print("Cleanup complete.")
        sys.exit(0)

if __name__ == "__main__":
    main()