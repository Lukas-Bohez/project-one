import RPi.GPIO as GPIO
import time

class ServoMotor:
    def __init__(self, pin=24, min_pulse=0.5, max_pulse=2.5, frequency=50):
        """
        Initialize the servo motor controller
        :param pin: GPIO pin number (BCM numbering)
        :param min_pulse: Minimum pulse width in ms (default 0.5ms)
        :param max_pulse: Maximum pulse width in ms (default 2.5ms)
        :param frequency: PWM frequency in Hz (default 50Hz)
        """
        self.pin = pin
        self.min_pulse = min_pulse
        self.max_pulse = max_pulse
        self.frequency = frequency
        self.current_angle = None
        
        # Setup GPIO
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.pin, GPIO.OUT)
        
        # Create PWM instance
        self.pwm = GPIO.PWM(self.pin, self.frequency)
        self.pwm.start(0)
    
    def set_angle(self, angle):
        """
        Set the servo to a specific angle
        :param angle: Desired angle (0 to 180 degrees)
        """
        if angle < 0:
            angle = 0
        elif angle > 180:
            angle = 180
            
        # Calculate duty cycle
        pulse_width = self.min_pulse + (angle / 180.0) * (self.max_pulse - self.min_pulse)
        duty_cycle = (pulse_width / (1000.0 / self.frequency)) * 100.0
        
        self.pwm.ChangeDutyCycle(duty_cycle)
        self.current_angle = angle
        time.sleep(0.3)  # Allow time for servo to move
    
    def sweep(self, start_angle=0, end_angle=180, step=1, delay=0.02):
        """
        Sweep the servo between two angles
        :param start_angle: Starting angle (default 0)
        :param end_angle: Ending angle (default 180)
        :param step: Angle step size (default 1)
        :param delay: Delay between steps in seconds (default 0.02)
        """
        if start_angle < end_angle:
            for angle in range(start_angle, end_angle + 1, step):
                self.set_angle(angle)
                time.sleep(delay)
        else:
            for angle in range(start_angle, end_angle - 1, -step):
                self.set_angle(angle)
                time.sleep(delay)
    
    def cleanup(self):
        """
        Clean up GPIO resources
        """
        self.pwm.stop()
        GPIO.cleanup()


# Example usage
if __name__ == "__main__":
    try:
        servo = ServoMotor(pin=24)  # Using GPIO 24 (BCM numbering)
        
        # Move to 90 degrees
        servo.set_angle(90)
        time.sleep(1)
        
        # Sweep from 0 to 180 degrees
        servo.sweep()
        
        # Move to 0 degrees
        servo.set_angle(0)
        
    except KeyboardInterrupt:
        print("Program stopped by user")
    finally:
        servo.cleanup()