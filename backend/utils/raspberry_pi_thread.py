"""
Raspberry Pi Hardware Integration Module
Handles RFID reader, servo motor, temperature sensor, light sensor, and LCD display
"""
import time
import socket
import queue
import traceback
from threading import Thread, Event
from datetime import datetime
from database.datarepository import UserRepository, SensorDataRepository, QuizSessionRepository
from collections import defaultdict


# Global variables
servo = None
temp_sensor = None
light_sensor = None
previous_temperature = None
previous_illuminance = None
newClient = None
virtualTemperature = 0

# Constants
REFRESH_INTERVAL = 1
RFID_DISPLAY_TIME = 20
SERVO_IDLE_ANGLE = 90


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


def rfid_reader_thread(rfid_sensor, rfid_queue, stop_event):
    """
    Dedicated thread to continuously read from RFID sensor
    """
    while not stop_event.is_set():
        try:
            uid = rfid_sensor.read_card()
            if uid:
                rfid_queue.put(str(uid))
        except Exception as e:
            print(f"Error in RFID reader thread: {e}")
            time.sleep(2)
    print("RFID reader thread finished.")


def raspberry_pi_main_thread(stop_event, sio, loop):
    """
    Main Raspberry Pi hardware management thread
    """
    global servo, light_sensor, temp_sensor
    
    try:
        from raspberryPi5.RFIDYReaderske import HardcoreRFID
        from raspberryPi5.servomotor import ServoMotor
        from raspberryPi5.temperature import TemperatureSensor
        from raspberryPi5.mcpLighty import LightSensor
        from raspberryPi5.lcd import LCD1602A
    except ImportError as e:
        print(f"Skipping Raspberry Pi thread start due to import errors: {e}")
        return

    # Initialize components
    lcd, rfid, temp_sensor, light_sensor, servo = (None,) * 5
    rfid_thread = None

    try:
        lcd = LCD1602A()
        rfid = HardcoreRFID()
        temp_sensor = TemperatureSensor()
        light_sensor = LightSensor()
        servo = ServoMotor()
        
        rfid_queue = queue.Queue()
        rfid_thread = Thread(
            target=rfid_reader_thread, 
            args=(rfid, rfid_queue, stop_event),
            daemon=True
        )
        rfid_thread.start()

    except Exception as e:
        print(f"Failed to initialize Raspberry Pi components: {e}")
        print(traceback.format_exc())
        stop_event.set()
        return

    # Initial positions and state
    if servo:
        servo.set_angle(SERVO_IDLE_ANGLE)
    last_refresh = 0
    rfid_display_start = 0
    showing_rfid = False
    
    if lcd:
        lcd.clear()
        ip_address = get_ip_address()
        lcd.write_line(0, ip_address[:16])

    try:
        while not stop_event.is_set():
            current_time = time.time()

            # Check for new RFID scans
            try:
                rfid_code = rfid_queue.get_nowait()
                showing_rfid = True
                rfid_display_start = current_time

                if lcd:
                    lcd.clear()
                    lcd.write_line(0, f"RFID:{rfid_code[:16]}")
                
                existing_user = UserRepository.get_user_by_rfid(rfid_code)
                if existing_user:
                    if lcd:
                        name_line = f"{existing_user['first_name']} {existing_user['last_name']}"
                        lcd.write_line(1, name_line[:16])
                else:
                    open_user_data = {
                        'last_name': 'Open', 'first_name': 'Open',
                        'password': 'temp_password_for_open_user', 'rfid_code': rfid_code,
                        'userRoleId': 2, 'soul_points': 4, 'limb_points': 4, 'updated_by': 1
                    }
                    new_user_id = UserRepository.create_user(open_user_data)
                    if lcd:
                        if new_user_id:
                            print(f"Created user ID: {new_user_id}")
                            lcd.write_line(1, "New user created!")
                        else:
                            print("User creation failed!")
                            lcd.write_line(1, "Creation failed!")
            
            except queue.Empty:
                pass
            except Exception as e:
                print(f"Error processing RFID from queue: {e}")

            # Reset display after RFID info
            if showing_rfid and (current_time - rfid_display_start) >= RFID_DISPLAY_TIME:
                showing_rfid = False
                if lcd:
                    lcd.clear()
                    lcd.write_line(0, ip_address[:16])
                last_refresh = 0

            # Update sensor display
            if not showing_rfid and (current_time - last_refresh) >= REFRESH_INTERVAL:
                try:
                    if all((temp_sensor, light_sensor, servo, lcd)):
                        temp = temp_sensor.read_temperature()
                        lux = light_sensor()
                        current_angle = servo.read_degrees()
                        lcd.write_line(1, format_second_row(temp, lux, current_angle)[:16])
                        last_refresh = current_time
                        
                        sensor_data = {'temperature': temp, 'illuminance': lux, 'servo_angle': current_angle}
                        emit_sensor_data(sensor_data, sio, loop)

                except Exception as e:
                    print("Sensor read/display error")
                    if lcd:
                        lcd.write_line(1, "Sensor Error")
                    last_refresh = current_time

            # Handle quiz session logic
            try:
                from utils.quiz_helpers import get_active_session_id, should_update_quiz_session
                from utils.quiz_helpers import read_sensor_data, log_quiz_sensor_data, emit_theme_selection_if_needed
                
                if get_active_session_id():
                    if should_update_quiz_session(current_time):
                        session_id = get_active_session_id()
                        sensor_data = read_sensor_data(temp_sensor, light_sensor, servo)
                        log_quiz_sensor_data(session_id, sensor_data)
                        emit_theme_selection_if_needed(sio, loop)
            except Exception as e:
                print(f"Error in quiz session logic block: {e}")

            time.sleep(0.05)

    except Exception as e:
        print(f"Fatal error in Pi thread: {e}")
        print(traceback.format_exc())
    finally:
        print("Pi thread cleanup initiated.")
        stop_event.set()
        
        if rfid_thread and rfid_thread.is_alive():
            print("Waiting for RFID thread to finish...")
            rfid_thread.join(timeout=2)

        try:
            if servo:
                servo.set_angle(SERVO_IDLE_ANGLE)
                time.sleep(0.5)
                servo.cleanup()
            if lcd:
                lcd.clear()
                lcd.cleanup()
            print("Pi thread cleanup complete.")
        except Exception as e:
            print(f"Pi thread cleanup error: {e}")


def should_emit(current_temp, current_lux):
    """Check if sensor data should be emitted based on thresholds"""
    global previous_temperature, previous_illuminance, newClient
    
    if (previous_temperature is None or 
        previous_illuminance is None or 
        newClient is not None):
        previous_temperature = current_temp
        previous_illuminance = current_lux
        newClient = None
        return True
    
    temp_changed = abs(current_temp - previous_temperature) > 1
    lux_changed = abs(current_lux - previous_illuminance) > 1
    
    if temp_changed or lux_changed:
        previous_temperature = current_temp
        previous_illuminance = current_lux
        return True
    
    return False


def emit_sensor_data(sensor_data, sio, loop):
    """Emit sensor data via Socket.IO if changes exceed thresholds"""
    global newClient
    import asyncio
    try:
        if should_emit(sensor_data['temperature'], sensor_data['illuminance']):
            asyncio.run_coroutine_threadsafe(
                sio.emit('sensor_data', sensor_data),
                loop
            )
    except Exception as e:
        print("Error emitting sensor_data from thread")
