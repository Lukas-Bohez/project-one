import time
import smbus2
import RPi.GPIO as GPIO
import socket

class LCD1602A:
    """
    Silent LCD 1602A-1 driver with robust error handling
    Continues operation even if hardware fails or is disconnected
    """
    
    # LCD Commands
    CMD_CLEAR_DISPLAY = 0x01
    CMD_RETURN_HOME = 0x02
    CMD_ENTRY_MODE = 0x04
    CMD_DISPLAY_CONTROL = 0x08
    CMD_CURSOR_SHIFT = 0x10
    CMD_FUNCTION_SET = 0x20
    CMD_SET_CGRAM_ADDR = 0x40
    CMD_SET_DDRAM_ADDR = 0x80
    
    # Line addresses
    LINE_1 = 0x00
    LINE_2 = 0x40
    
    def __init__(self, i2c_addr=0x38, i2c_bus=1, rs_pin=20, e_pin=21):
        self.i2c_addr = i2c_addr
        self.rs_pin = rs_pin
        self.e_pin = e_pin
        self.initialized = False
        
        try:
            # Initialize I2C bus
            self.bus = smbus2.SMBus(i2c_bus)
            
            # Setup GPIO
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(self.rs_pin, GPIO.OUT)
            GPIO.setup(self.e_pin, GPIO.OUT)
            
            # Initialize pins to low
            GPIO.output(self.rs_pin, GPIO.LOW)
            GPIO.output(self.e_pin, GPIO.LOW)
            
            # Initialize the PCF8574 to 0
            self.bus.write_byte(self.i2c_addr, 0x00)
            
            # Initialize display
            self._init_display()
            self.initialized = True
        except Exception:
            self.initialized = False
    
    def _write_data_to_lcd(self, data):
        """Silently write data to LCD"""
        if not self.initialized:
            return
            
        try:
            self.bus.write_byte(self.i2c_addr, data)
        except Exception:
            self.initialized = False
    
    def _pulse_enable(self):
        """Silently pulse enable pin"""
        if not self.initialized:
            return
            
        try:
            GPIO.output(self.e_pin, GPIO.HIGH)
            time.sleep(0.001)
            GPIO.output(self.e_pin, GPIO.LOW)
            time.sleep(0.001)
        except Exception:
            self.initialized = False
    
    def _write_8bits(self, data, is_data=False):
        """Silently write 8-bit command or data"""
        if not self.initialized:
            return
            
        try:
            GPIO.output(self.e_pin, GPIO.HIGH)
            GPIO.output(self.rs_pin, GPIO.HIGH if is_data else GPIO.LOW)
            self._write_data_to_lcd(data)
            time.sleep(0.001)
            GPIO.output(self.e_pin, GPIO.LOW)
            
            if not is_data:
                time.sleep(0.005 if data in [self.CMD_CLEAR_DISPLAY, self.CMD_RETURN_HOME] else 0.001)
            else:
                time.sleep(0.001)
        except Exception:
            self.initialized = False
    
    def _init_display(self):
        """Silently initialize display"""
        try:
            time.sleep(0.050)
            
            # Initial state
            GPIO.output(self.rs_pin, GPIO.LOW)
            GPIO.output(self.e_pin, GPIO.LOW)
            self._write_data_to_lcd(0x00)
            time.sleep(0.020)
            
            # Function Set
            function_set_cmd = self.CMD_FUNCTION_SET | 0x10 | 0x08 | 0x00
            self._write_8bits(function_set_cmd)
            time.sleep(0.010)
            
            # Display On
            display_on_cmd = self.CMD_DISPLAY_CONTROL | 0x04
            self._write_8bits(display_on_cmd)
            time.sleep(0.010)
            
            # Clear display
            self._write_8bits(self.CMD_CLEAR_DISPLAY)
            time.sleep(0.010)
        except Exception:
            self.initialized = False
    
    def clear(self):
        """Silently clear display"""
        if self.initialized:
            self._write_8bits(self.CMD_CLEAR_DISPLAY)
            time.sleep(0.005)
    
    def home(self):
        """Silently return cursor home"""
        if self.initialized:
            self._write_8bits(self.CMD_RETURN_HOME)
            time.sleep(0.005)
    
    def set_cursor(self, col, row):
        """Silently set cursor position"""
        if not self.initialized:
            return
            
        try:
            addr = self.LINE_1 + col if row == 0 else self.LINE_2 + col
            self._write_8bits(self.CMD_SET_DDRAM_ADDR | addr)
        except Exception:
            self.initialized = False
    
    def write_char(self, char):
        """Silently write character"""
        if self.initialized:
            self._write_8bits(ord(char), is_data=True)
    
    def write_string(self, text):
        """Silently write string"""
        if not self.initialized:
            return
            
        try:
            for char in text:
                if char == '\n':
                    self.set_cursor(0, 1)
                else:
                    self.write_char(char)
        except Exception:
            self.initialized = False
    
    def write_line(self, line, text):
        """Silently write to specific line"""
        if not self.initialized:
            return
            
        try:
            self.set_cursor(0, line)
            text = text[:16].ljust(16)
            self.write_string(text)
        except Exception:
            self.initialized = False
    
    def cleanup(self):
        """Silently clean up resources"""
        try:
            GPIO.cleanup()
        except Exception:
            pass

def get_ip():
    """Get IP address with error handling"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "No IP"

if __name__ == "__main__":
    lcd = LCD1602A()
    
    try:
        while True:
            ip = get_ip()
            print(f"IP: {ip}")  # Will still print to console
            
            if lcd.initialized:
                lcd.clear()
                lcd.write_string(ip)
            else:
                print("LCD not initialized - running in silent mode")
            
            time.sleep(5)
    except KeyboardInterrupt:
        print("\nExiting...")
    finally:
        lcd.cleanup()