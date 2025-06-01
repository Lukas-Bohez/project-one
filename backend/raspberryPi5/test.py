#!/usr/bin/env python3

import time
import socket
import traceback
from RFIDYReaderske import HardcoreRFID
from servomotor import ServoMotor
from temperature import TemperatureSensor
from mcpLighty import LightSensor
from lcd import LCD1602A

# Constants
REFRESH_INTERVAL = 1  # seconds
RFID_DISPLAY_TIME = 3  # seconds to display RFID code (matches RFID cooldown)
SERVO_IDLE_ANGLE = 0  # Neutral position when idle

def get_ip_address():
    """Get the IP address of the Raspberry Pi"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "No IP"

def format_second_row(temp, lux, angle):
    """Format the second row of the LCD with sensor data"""
    return f"{temp:.1f}C {lux:.0f}L {angle}deg"

def main():
    # Initialize components
    try:
        lcd = LCD1602A()
        rfid = HardcoreRFID()
        servo = ServoMotor()
        temp_sensor = TemperatureSensor()
        light_sensor = LightSensor()
    except Exception as e:
        print(f"Failed to initialize components: {e}")
        print(traceback.format_exc())
        return

    # Initial positions
    servo.set_angle(SERVO_IDLE_ANGLE)
    current_angle = SERVO_IDLE_ANGLE
    
    # State variables
    last_refresh = 0
    rfid_display_start = 0
    showing_rfid = False
    rfid_code = ""
    servo_active = False
    
    try:
        # Initial display setup
        lcd.clear()
        ip_address = get_ip_address()
        lcd.write_line(0, ip_address[:16])
        
        while True:
            current_time = time.time()
            
            try:
                # Only check for RFID if we're not currently showing one and servo isn't active
                if not showing_rfid and not servo_active:
                    uid = rfid.read_card()
                    if uid:  # RFID reader already handles cooldown and duplicate detection
                        rfid_code = uid
                        rfid_display_start = current_time
                        showing_rfid = True
                        
                        # Display RFID immediately
                        lcd.write_line(1, f"RFID:{rfid_code[:11]}")
                
                # Check if RFID display time has expired and start servo sweep
                if showing_rfid and not servo_active and (current_time - rfid_display_start) >= RFID_DISPLAY_TIME:
                    servo_active = True
                    try:
                        # Simple single sweep from 0 to 180 degrees in exactly 3 seconds
                        sweep_start_time = time.time()
                        sweep_duration = 3.0  # 3 seconds total
                        start_angle = 0
                        end_angle = 180
                        
                        while time.time() - sweep_start_time < sweep_duration:
                            # Calculate current position based on time elapsed
                            elapsed = time.time() - sweep_start_time
                            progress = elapsed / sweep_duration  # 0.0 to 1.0
                            if progress > 1.0:
                                progress = 1.0
                            
                            # Calculate angle and round to nearest 5 degrees
                            raw_angle = start_angle + (end_angle - start_angle) * progress
                            angle = round(raw_angle / 5) * 5  # Round to nearest multiple of 5
                            
                            servo.set_angle(angle)
                            temp = temp_sensor.read_temperature()
                            lux = light_sensor()
                            current_degrees = servo.read_degrees()
                            lcd.write_line(1, format_second_row(temp, lux, current_degrees)[:16])
                            
                            time.sleep(0.05)  # Small delay for sensor readings
                        
                        # Ensure we end at exactly 180 degrees
                        servo.set_angle(180)
                        time.sleep(0.1)
                        
                        # Return to idle position
                        servo.set_angle(SERVO_IDLE_ANGLE)
                        current_angle = servo.read_degrees()
                        
                    except Exception as e:
                        print(f"Servo sweep error: {e}")
                    finally:
                        servo_active = False
                        showing_rfid = False  # Done with RFID sequence
                        lcd.clear()
                        lcd.write_line(0, ip_address[:16])
                        last_refresh = 0  # Force immediate normal display update
            
                # Update normal display at regular intervals (only when not showing RFID)
                if not showing_rfid and (current_time - last_refresh) >= REFRESH_INTERVAL:
                    try:
                        temp = temp_sensor.read_temperature()
                        lux = light_sensor()
                        current_angle = servo.read_degrees()
                        lcd.write_line(1, format_second_row(temp, lux, current_angle)[:16])
                        last_refresh = current_time
                    except Exception as e:
                        print(f"Sensor read error: {e}")
                        lcd.write_line(1, "Sensor Error")
                        last_refresh = current_time
                
                time.sleep(0.05)  # Reduced sleep for more responsive RFID detection
                
            except Exception as e:
                print(f"Main loop error: {e}")
                print(traceback.format_exc())
                time.sleep(1)
    
    except KeyboardInterrupt:
        print("\nExiting...")
    except Exception as e:
        print(f"Fatal error: {e}")
        print(traceback.format_exc())
    finally:
        try:
            servo.set_angle(SERVO_IDLE_ANGLE)  # Return to neutral position
            time.sleep(0.5)
            lcd.clear()
            servo.cleanup()
            lcd.cleanup()
        except Exception as e:
            print(f"Cleanup error: {e}")

if __name__ == "__main__":
    main()