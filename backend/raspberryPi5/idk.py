#!/usr/bin/env python3
import pygame
import sys
import time

def detect_controller_buttons():
    """Detect and map all buttons on your SNES controller"""
    
    # Initialize pygame
    pygame.init()
    pygame.joystick.init()
    
    # Check for joystick
    if pygame.joystick.get_count() == 0:
        print("No gamepad found! Connect your SNES controller and try again.")
        return
    
    # Initialize joystick
    joystick = pygame.joystick.Joystick(0)
    joystick.init()
    
    print(f"Controller detected: {joystick.get_name()}")
    print(f"Number of buttons: {joystick.get_num_buttons()}")
    print(f"Number of axes: {joystick.get_num_axes()}")
    print(f"Number of hats: {joystick.get_num_hats()}")
    print("\n" + "="*50)
    print("BUTTON MAPPING DETECTOR")
    print("="*50)
    print("Press each button on your SNES controller to see its mapping:")
    print("Expected buttons: A, B, X, Y, L, R, SELECT, START")
    print("Press ESC or wait 30 seconds to exit")
    print("\nPress buttons now...")
    
    button_pressed = {}
    start_time = time.time()
    
    try:
        while True:
            # Check for timeout
            if time.time() - start_time > 30:
                print("\nTimeout reached, exiting...")
                break
                
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        print("\nESC pressed, exiting...")
                        return
                elif event.type == pygame.JOYBUTTONDOWN:
                    button_index = event.button
                    if button_index not in button_pressed:
                        button_pressed[button_index] = True
                        print(f"Button {button_index} pressed")
                        
                        # Reset timer when button is pressed
                        start_time = time.time()
            
            pygame.time.wait(10)
    
    except KeyboardInterrupt:
        print("\nInterrupted by user")
    
    finally:
        # Generate the mapping
        if button_pressed:
            print("\n" + "="*50)
            print("DETECTED BUTTON MAPPING")
            print("="*50)
            print("Copy this mapping to your main script:")
            print("\nbutton_map = {")
            for button_index in sorted(button_pressed.keys()):
                print(f"    {button_index}: 'BTN{button_index}',  # Update this with actual button name")
            print("}")
            print("\nNow test each button individually and update the mapping!")
            print("Common SNES mappings:")
            print("- A, B, X, Y are usually buttons 0-3")
            print("- L, R are usually buttons 4-5")
            print("- SELECT, START vary widely (could be 6,7 or 8,9 or others)")
        else:
            print("\nNo buttons detected!")
        
        pygame.quit()

def test_specific_buttons():
    """Test specific button combinations"""
    
    # Initialize pygame
    pygame.init()
    pygame.joystick.init()
    
    # Check for joystick
    if pygame.joystick.get_count() == 0:
        print("No gamepad found!")
        return
    
    # Initialize joystick
    joystick = pygame.joystick.Joystick(0)
    joystick.init()
    
    print(f"Controller: {joystick.get_name()}")
    print("\nTesting SELECT and START buttons...")
    print("Try pressing SELECT and START together")
    print("Press ESC to exit")
    
    # Test common SELECT/START combinations
    test_combinations = [
        (6, 7),   # Common mapping
        (6, 9),   # Your current mapping
        (8, 9),   # Another common mapping
        (4, 5),   # Sometimes L/R are mapped differently
        (10, 11), # Extended mapping
    ]
    
    print("\nTesting these button combinations for SELECT+START:")
    for combo in test_combinations:
        print(f"  Buttons {combo[0]} + {combo[1]}")
    
    button_states = {}
    
    try:
        while True:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        return
                elif event.type == pygame.JOYBUTTONDOWN:
                    button_states[event.button] = True
                    print(f"Button {event.button} pressed")
                    
                    # Check combinations
                    for combo in test_combinations:
                        if combo[0] in button_states and combo[1] in button_states:
                            if button_states[combo[0]] and button_states[combo[1]]:
                                print(f"*** COMBINATION DETECTED: {combo[0]} + {combo[1]} ***")
                                print(f"Update your code: SELECT = {combo[0]}, START = {combo[1]}")
                
                elif event.type == pygame.JOYBUTTONUP:
                    if event.button in button_states:
                        button_states[event.button] = False
                        print(f"Button {event.button} released")
            
            pygame.time.wait(10)
    
    except KeyboardInterrupt:
        print("\nInterrupted by user")
    
    finally:
        pygame.quit()

if __name__ == "__main__":
    print("SNES Controller Button Mapper")
    print("1. Detect all buttons")
    print("2. Test SELECT+START combinations")
    
    choice = input("\nEnter choice (1 or 2): ").strip()
    
    if choice == "1":
        detect_controller_buttons()
    elif choice == "2":
        test_specific_buttons()
    else:
        print("Invalid choice")