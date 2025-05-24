#!/usr/bin/env python3
import evdev
from evdev import ecodes, InputDevice, categorize
import uinput
import time
import sys
import os

# Mouse movement speed (higher = faster)
MOUSE_SPEED = 5
SCROLL_SPEED = 2

# Initialize virtual mouse
device = uinput.Device([
    uinput.BTN_LEFT,
    uinput.BTN_RIGHT,
    uinput.REL_X,
    uinput.REL_Y,
    uinput.REL_WHEEL,
])

def find_gamepad():
    """Find the gamepad device"""
    devices = [InputDevice(path) for path in evdev.list_devices()]
    for device in devices:
        if "gamepad" in device.name.lower() or "joystick" in device.name.lower():
            print(f"Found gamepad: {device.name} at {device.path}")
            return device
    return None

def main():
    print("Looking for gamepad...")
    gamepad = None
    
    while gamepad is None:
        gamepad = find_gamepad()
        if gamepad is None:
            print("Gamepad not found. Please connect it and try again.")
            time.sleep(2)
    
    print("Gamepad connected. Starting controller...")
    print("Press both START + SELECT simultaneously to toggle sleep mode.")
    print("Press both A + B simultaneously to exit the script.")
    
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
                # Handle button presses gently
                if event.code == ecodes.BTN_TL or event.code == ecodes.BTN_TL2:
                    if not btn_state['was_asleep']:
                        btn_state['left_bumper'] = event.value
                        device.emit(uinput.BTN_LEFT, event.value)
                
                elif event.code == ecodes.BTN_TR or event.code == ecodes.BTN_TR2:
                    if not btn_state['was_asleep']:
                        btn_state['right_bumper'] = event.value
                        device.emit(uinput.BTN_RIGHT, event.value)
                
                elif event.code == ecodes.BTN_NORTH:  # Typically Y button
                    if not btn_state['was_asleep']:
                        btn_state['y'] = event.value
                        if event.value:
                            device.emit(uinput.REL_WHEEL, SCROLL_SPEED)
                
                elif event.code == ecodes.BTN_WEST:  # Typically X button
                    if not btn_state['was_asleep']:
                        btn_state['x'] = event.value
                        if event.value:
                            device.emit(uinput.REL_WHEEL, -SCROLL_SPEED)
                
                elif event.code == ecodes.BTN_SOUTH:  # Typically A button
                    btn_state['a'] = event.value
                    if not btn_state['was_asleep']:
                        os.system("amixer set Master 5%+")  # Volume up when A is pressed
                        pass
                
                elif event.code == ecodes.BTN_EAST:  # Typically B button
                    btn_state['b'] = event.value
                    if not btn_state['was_asleep']:
                        os.system("amixer set Master 5%-")
                        pass
                
                # Check for A+B exit combo (regardless of sleep state)
                if btn_state['a'] and btn_state['b']:
                    print("A + B pressed. Exiting script...")
                    return
                
                elif event.code == ecodes.BTN_START:
                    btn_state['start'] = event.value
                    if btn_state['start'] and btn_state['select']:
                        if btn_state['was_asleep']:
                            print("Waking up from sleep...")
                            btn_state['was_asleep'] = False
                        else:
                            print("Going to sleep...")
                            os.system("sudo systemctl suspend")
                            btn_state['was_asleep'] = True
                
                elif event.code == ecodes.BTN_SELECT:
                    btn_state['select'] = event.value
                    if btn_state['start'] and btn_state['select']:
                        if btn_state['was_asleep']:
                            print("Waking up from sleep...")
                            btn_state['was_asleep'] = False
                        else:
                            print("Going to sleep...")
                            os.system("sudo systemctl suspend")
                            btn_state['was_asleep'] = True
            
            elif event.type == ecodes.EV_ABS and not btn_state['was_asleep']:
                # Handle D-pad movement (only when not asleep)
                if event.code == ecodes.ABS_X or event.code == ecodes.ABS_HAT0X:
                    btn_state['dpad_x'] = event.value
                
                elif event.code == ecodes.ABS_Y or event.code == ecodes.ABS_HAT0Y:
                    btn_state['dpad_y'] = event.value
                
                # Emit mouse movement based on D-pad
                x_movement = 0
                y_movement = 0
                
                if btn_state['dpad_x'] == 0:  # Left
                    x_movement = -MOUSE_SPEED
                elif btn_state['dpad_x'] == 255:  # Right (assuming 8-bit axis)
                    x_movement = MOUSE_SPEED
                
                if btn_state['dpad_y'] == 0:  # Up (often inverted)
                    y_movement = -MOUSE_SPEED
                elif btn_state['dpad_y'] == 255:  # Down
                    y_movement = MOUSE_SPEED
                
                if x_movement != 0:
                    device.emit(uinput.REL_X, x_movement)
                if y_movement != 0:
                    device.emit(uinput.REL_Y, y_movement)
    
    except KeyboardInterrupt:
        print("\nExiting...")
    except IOError:
        print("Gamepad disconnected.")
    finally:
        # Clean up
        device.destroy()
        sys.exit(0)

if __name__ == "__main__":
    main()



'''
How to Use

    Save this script as gamepad_mouse.py

    Make it executable: chmod +x gamepad_mouse.py

    Run it with sudo: sudo ./gamepad_mouse.py

Customization Options

    Button Mapping: You can customize the button functions by modifying the BUTTON_MAP dictionary.

    Speed Adjustment: Change MOUSE_SPEED and SCROLL_SPEED to adjust sensitivity.

    Additional Functions: For the A and B buttons, and Start/Select individually, add your custom functions where indicated in the code.

Auto-start on Boot

To make this script run automatically when your Raspberry Pi starts:

    Create a service file: sudo nano /etc/systemd/system/gamepadmouse.service

    Add this content:



[Unit]
Description=Gamepad Mouse Controller
After=multi-user.target

[Service]
ExecStart=/usr/bin/python3 /path/to/gamepad.py
Restart=always
User=root

[Install]
WantedBy=multi-user.target
'''