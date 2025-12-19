"""
Quiz Helper Functions
Utility functions for quiz state management and sensor data processing
"""
import time
from datetime import datetime
from threading import Lock
from database.datarepository import SensorDataRepository, QuizSessionRepository


# Module-level variables
last_update_time = 0
virtualTemperature = 0
sensorData = None


def get_active_session_id():
    """Get the ID of the first active session (excluding support session 999999)"""
    active_sessions = QuizSessionRepository.get_sessions_by_status(2)
    quiz_sessions = [session for session in active_sessions if session[0] != 999999]
    return quiz_sessions[0][0] if quiz_sessions else None


def should_update_quiz_session(current_time):
    """Check if we should update based on time threshold"""
    global last_update_time
    if current_time - last_update_time >= 1:
        last_update_time = current_time
        return True
    return False


def read_sensor_data(temp_sensor, light_sensor, servo):
    """Read all sensor values with proper temperature validation"""
    global virtualTemperature, sensorData
    try:
        raw_temp = temp_sensor.read_temperature()
        
        if raw_temp is None or not isinstance(raw_temp, (int, float)):
            temperature = 0.0
        else:
            temperature = max(-50.0, min(100.0, float(raw_temp)))
            temperature = round(temperature, 2) + virtualTemperature
            sensorData = {'temperature': temperature, 'illuminance': light_sensor()}
        
        return {
            'temperature': temperature,
            'illuminance': light_sensor(),
            'servo_angle': servo.read_degrees()
        }
    except Exception as e:
        print(f"Error reading sensor data: {e}")
        return {
            'temperature': 0.0,
            'illuminance': 0,
            'servo_angle': 0
        }


def log_quiz_sensor_data(session_id, sensor_data):
    """Log sensor data to quiz session"""
    try:
        SensorDataRepository.create_sensor_data(
            sessionId=session_id,
            temperature=sensor_data['temperature'],
            lightIntensity=sensor_data['illuminance'],
            servoPosition=sensor_data['servo_angle'],
            timestamp=datetime.now()
        )
    except Exception as e:
        print(f"Error logging sensor data: {e}")


def check_sensor_data(temp_sensor, light_sensor):
    """Read sensor values with validation (no servo)"""
    try:
        raw_temp = temp_sensor.read_temperature()
        
        if raw_temp is None or not isinstance(raw_temp, (int, float)):
            temperature = 0.0
        else:
            temperature = max(-50.0, min(100.0, float(raw_temp)))
            temperature = round(temperature, 2)
        
        return {
            'temperature': temperature,
            'illuminance': light_sensor(),
        }
    except Exception as e:
        print(f"Error reading sensor data: {e}")
        return {
            'temperature': 0.0,
            'illuminance': 0,
        }


def calculate_impact(sensorData):
    """Calculate environmental impact multiplier from sensor data"""
    temperature = sensorData['temperature']
    illuminance = sensorData['illuminance']
    
    # Temperature impact (dominant factor)
    temp_norm = (min(max(temperature, -5), 45) + 5) / 50
    temp_impact = 0.7 + 0.6 * (2 * temp_norm - 1) ** 3
    
    # Illuminance impact (secondary factor)
    illum_norm = min(max(illuminance, 0), 100) / 100
    illum_impact = 0.4 * (illum_norm ** 0.5)
    
    # Combine impacts
    combined = temp_impact + illum_impact
    final_value = 0.5 + (combined - 0.1) * (1.5 / 1.6)
    
    return min(max(final_value, 0.5), 2)


# Import this function here to avoid circular imports
# It will be defined in quiz_timer_system.py
def emit_theme_selection_if_needed(sio, loop):
    """Placeholder - actual implementation in quiz_timer_system.py"""
    try:
        from utils.quiz_timer_system import emit_theme_selection_if_needed as real_func
        return real_func(sio, loop)
    except ImportError as e:
        print(f"quiz_timer_system.py import failed: {e}")
        return None
