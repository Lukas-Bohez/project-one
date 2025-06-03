import RPi.GPIO as GPIO
import time

class ServoMotor:
    def __init__(self, pin=24, min_pulse=0.5, max_pulse=2.5, frequency=50):
        """
        Initialize the servo motor controller with angle change detection
        :param pin: GPIO pin number (BCM numbering)
        :param min_pulse: Minimum pulse width in ms (default 0.5ms)
        :param max_pulse: Maximum pulse width in ms (default 2.5ms)
        :param frequency: PWM frequency in Hz (default 50Hz)
        """
        self.pin = pin
        self.min_pulse = min_pulse
        self.max_pulse = max_pulse
        self.frequency = frequency
        self.current_angle = 90  # Track the requested angle
        self.actual_servo_angle = 90  # Track the actual servo position (only updates when servo moves)
       
        # Setup GPIO
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.pin, GPIO.OUT)
       
        # Create PWM instance
        self.pwm = GPIO.PWM(self.pin, self.frequency)
        self.pwm.start(0)
        
        # Set initial position
        self._move_servo(90)
   
    def _move_servo(self, angle):
        """
        Internal method to actually move the servo
        :param angle: Angle to move to
        """
        # Calculate duty cycle
        pulse_width = self.min_pulse + (angle / 180.0) * (self.max_pulse - self.min_pulse)
        duty_cycle = (pulse_width / (1000.0 / self.frequency)) * 100.0
       
        self.pwm.ChangeDutyCycle(duty_cycle)
        self.actual_servo_angle = angle
        time.sleep(0.3)  # Allow time for servo to move
        
        # Turn off PWM signal after movement to save power
        self.pwm.ChangeDutyCycle(0)
   
    def set_angle(self, angle):
        """
        Set the servo to a specific angle, but only update if angle changed by >=5 degrees
        :param angle: Desired angle (0 to 180 degrees)
        """
        if angle < 0:
            angle = 0
        elif angle > 180:
            angle = 180
           
        # Always update the current_angle to track what was requested
        self.current_angle = angle
        
        # Only physically move the servo if the angle changed by 5 degrees or more
        # from the actual servo position
        if abs(angle - self.actual_servo_angle) >= 5:
            self._move_servo(angle)
            print(f"Servo moved to {angle}°")
        else:
            print(f"Servo stays at {self.actual_servo_angle}° (requested {angle}°, difference < 5°)")
   
    def read_degrees(self):
        """
        Return the current angle of the servo (actual position)
        :return: Current angle in degrees
        """
        return self.actual_servo_angle
   
    def get_requested_angle(self):
        """
        Return the last requested angle
        :return: Last requested angle in degrees
        """
        return self.current_angle
   
    def sweep(self, start_angle=0, end_angle=180, step=5, delay=0.1):
        """
        Sweep the servo between two angles with 5-degree steps
        :param start_angle: Starting angle (default 0)
        :param end_angle: Ending angle (default 180)
        :param step: Angle step size (default 5)
        :param delay: Delay between steps in seconds (default 0.1)
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
        """Clean up GPIO resources"""
        self.pwm.stop()
        GPIO.cleanup()

# Example usage
if __name__ == "__main__":
    try:
        servo = ServoMotor(pin=24)  # Using GPIO 24 (BCM numbering)
       
        print("Testing power-efficient servo movement:")
        
        # Test 1: Move to 90 degrees (should move since it's already there, difference = 0)
        print("\nTest 1: Move to 90°")
        servo.set_angle(90)
        print(f"Actual servo position: {servo.read_degrees()}°")
        
        # Test 2: Move to 92 degrees (should NOT move, difference < 5)
        print("\nTest 2: Move to 92°")
        servo.set_angle(92)
        print(f"Actual servo position: {servo.read_degrees()}°")
        
        # Test 3: Move to 95 degrees (should move, difference = 5)
        print("\nTest 3: Move to 95°")
        servo.set_angle(95)
        print(f"Actual servo position: {servo.read_degrees()}°")
        
        # Test 4: Move to 97 degrees (should NOT move, difference = 2)
        print("\nTest 4: Move to 97°")
        servo.set_angle(97)
        print(f"Actual servo position: {servo.read_degrees()}°")
        
        # Test 5: Move to 0 degrees (should move, large difference)
        print("\nTest 5: Move to 0°")
        servo.set_angle(0)
        print(f"Actual servo position: {servo.read_degrees()}°")
        
        # Test 6: Move to 0 degrees again (should NOT move)
        print("\nTest 6: Move to 0° again")
        servo.set_angle(0)
        print(f"Actual servo position: {servo.read_degrees()}°")
        
        time.sleep(1)
        
        # Sweep from 0 to 180 degrees (will only move in 5-degree increments)
        print("\nPerforming sweep:")
        servo.sweep()
        print(f"Final position: {servo.read_degrees()}°")
       
    except KeyboardInterrupt:
        print("Program stopped by user")
    finally:
        servo.cleanup()