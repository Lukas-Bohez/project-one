import RPi.GPIO as GPIO
import time

class ServoMotor:
    def __init__(self, pin=24, min_pulse=0.5, max_pulse=2.5, frequency=50):
        """
        Initialize the servo motor controller with robust error handling
        """
        self.pin = pin
        self.min_pulse = min_pulse
        self.max_pulse = max_pulse
        self.frequency = frequency
        self.current_angle = 90  # Track the requested angle
        self.actual_servo_angle = 90  # Track the actual servo position
        self.pwm = None
        self.initialized = False
        
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(self.pin, GPIO.OUT)
            self.pwm = GPIO.PWM(self.pin, self.frequency)
            self.pwm.start(0)
            self._move_servo(90)
            self.initialized = True
        except Exception:
            self.initialized = False
   
    def _move_servo(self, angle):
        """
        Internal method to move the servo with error handling
        """
        if not self.initialized:
            return
            
        try:
            # Calculate duty cycle
            pulse_width = self.min_pulse + (angle / 180.0) * (self.max_pulse - self.min_pulse)
            duty_cycle = (pulse_width / (1000.0 / self.frequency)) * 100.0
           
            if self.pwm is not None:
                self.pwm.ChangeDutyCycle(duty_cycle)
                self.actual_servo_angle = angle
                time.sleep(0.3)
                
                # Turn off PWM signal after movement
                self.pwm.ChangeDutyCycle(0)
        except Exception:
            self.initialized = False
   
    def set_angle(self, angle):
        """
        Set the servo angle with silent error handling
        """
        # Constrain angle
        angle = max(0, min(180, angle))
        self.current_angle = angle
        
        if not self.initialized:
            return
            
        try:
            # Only move if angle changed by >=5 degrees
            if abs(angle - self.actual_servo_angle) >= 5:
                self._move_servo(angle)
        except Exception:
            self.initialized = False
   
    def read_degrees(self):
        """
        Return the current angle (actual position)
        """
        return self.actual_servo_angle
   
    def get_requested_angle(self):
        """
        Return the last requested angle
        """
        return self.current_angle
   
    def sweep(self, start_angle=0, end_angle=180, step=5, delay=0.1):
        """
        Sweep the servo between angles with error handling
        """
        if not self.initialized:
            return
            
        try:
            if start_angle < end_angle:
                for angle in range(start_angle, end_angle + 1, step):
                    self.set_angle(angle)
                    time.sleep(delay)
            else:
                for angle in range(start_angle, end_angle - 1, -step):
                    self.set_angle(angle)
                    time.sleep(delay)
        except Exception:
            self.initialized = False
   
    def cleanup(self):
        """
        Properly clean up resources with robust error handling
        """
        try:
            if self.pwm is not None:
                # Ensure we're not in a bad state before cleanup
                try:
                    self.pwm.ChangeDutyCycle(0)
                    time.sleep(0.1)
                except Exception:
                    pass
                
                # Stop PWM
                try:
                    self.pwm.stop()
                except Exception:
                    pass
                
                self.pwm = None
            
            # Cleanup GPIO
            try:
                GPIO.cleanup(self.pin)
            except Exception:
                try:
                    GPIO.cleanup()
                except Exception:
                    pass
        except Exception:
            pass

    def __del__(self):
        """
        Destructor to ensure proper cleanup
        """
        self.cleanup()

# Example usage
if __name__ == "__main__":
    servo = None
    try:
        servo = ServoMotor(pin=24)  # Using GPIO 24 (BCM numbering)

        print("Testing servo movement:")

        # Test movements
        print("\nTest 1: Move to 90°")
        servo.set_angle(90)
        print(f"Reported position: {servo.read_degrees()}°")
        
        print("\nTest 2: Move to 45°")
        servo.set_angle(45)
        print(f"Reported position: {servo.read_degrees()}°")
        
        print("\nTest 3: Small movement to 47°")
        servo.set_angle(47)
        print(f"Reported position: {servo.read_degrees()}°")
        
        print("\nTest 4: Move to 135°")
        servo.set_angle(135)
        print(f"Reported position: {servo.read_degrees()}°")
        
        time.sleep(1)
        
        # Sweep test
        print("\nPerforming silent sweep:")
        servo.sweep()
        print(f"Final reported position: {servo.read_degrees()}°")
       
    except KeyboardInterrupt:
        print("Program stopped by user")
    except Exception as e:
        print(f"Unexpected error: {e}")
    finally:
        if servo is not None:
            servo.cleanup()
        print("Program exited cleanly")