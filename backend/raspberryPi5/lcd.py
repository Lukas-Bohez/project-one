import time
import smbus2
import RPi.GPIO as GPIO

class LCD1602A:
    """
    LCD 1602A-1 driver class for Raspberry Pi
    Data bits (D0-D7) connected via PCF8574 I2C expander (P0-P7)
    Control pins E and RS connected directly to GPIO
    R/W pin tied to ground (write mode only)
    
    Based on 1602A-1 datasheet specifications:
    - 16x2 character display
    - HD44780 compatible (ST7066U-0A controller)
    - 5V power supply
    - 8-bit interface
    """
    
    # LCD Commands (based on datasheet)
    CMD_CLEAR_DISPLAY = 0x01
    CMD_RETURN_HOME = 0x02
    CMD_ENTRY_MODE = 0x04
    CMD_DISPLAY_CONTROL = 0x08
    CMD_CURSOR_SHIFT = 0x10
    CMD_FUNCTION_SET = 0x20
    CMD_SET_CGRAM_ADDR = 0x40
    CMD_SET_DDRAM_ADDR = 0x80
    
    # Entry mode flags
    ENTRY_LEFT = 0x02
    ENTRY_SHIFT_INCREMENT = 0x01
    
    # Display control flags
    DISPLAY_ON = 0x04
    CURSOR_ON = 0x02
    BLINK_ON = 0x01
    
    # Function set flags
    FUNC_8BIT = 0x10
    FUNC_2LINE = 0x08
    FUNC_5x8DOTS = 0x00
    
    # Line addresses for 16x2 display
    LINE_1 = 0x00
    LINE_2 = 0x40
    
    def __init__(self, i2c_addr=0x38, i2c_bus=1, rs_pin=20, e_pin=21):
        """
        Initialize LCD with I2C data bus and direct GPIO control pins
        
        Args:
            i2c_addr: I2C address of PCF8574 expander (default 0x38)
            i2c_bus: I2C bus number (default 1)
            rs_pin: GPIO pin for RS (Register Select) - default 20
            e_pin: GPIO pin for E (Enable) - default 21
        """
        self.i2c_addr = i2c_addr
        self.rs_pin = rs_pin
        self.e_pin = e_pin
        
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
    
    def _write_data_to_lcd(self, data):
        """Write 8-bit data to LCD data pins D0-D7 via PCF8574 P0-P7"""
        try:
            # Write data byte directly to PCF8574
            # P0->D0, P1->D1, P2->D2, P3->D3, P4->D4, P5->D5, P6->D6, P7->D7
            self.bus.write_byte(self.i2c_addr, data)
        except Exception as e:
            print(f"I2C write error: {e}")
    
    def _pulse_enable(self):
        """Pulse the enable pin according to datasheet timing: E=HIGH -> Data -> E=LOW -> Wait"""
        # First set E HIGH
        GPIO.output(self.e_pin, GPIO.HIGH)
        # Wait for setup time
        time.sleep(0.001)
        # Data should already be set by caller
        # Now bring E LOW to latch the data (falling edge triggers)
        GPIO.output(self.e_pin, GPIO.LOW)
        # Wait for processing time
        time.sleep(0.001)
    
    def _write_8bits(self, data, is_data=False):
        """
        Write 8-bit command or data to LCD
        Sequence: E=HIGH -> Set RS -> Set Data -> E=LOW -> Wait
        
        Args:
            data: 8-bit value to write
            is_data: True for data, False for command
        """
        # First set E HIGH
        GPIO.output(self.e_pin, GPIO.HIGH)
        
        # Set RS pin (High for data, Low for command)
        GPIO.output(self.rs_pin, GPIO.HIGH if is_data else GPIO.LOW)
        
        # Set data on PCF8574 (D0-D7)
        self._write_data_to_lcd(data)
        
        # Small delay to ensure data is stable
        time.sleep(0.001)
        
        # Bring E LOW to latch the data (falling edge)
        GPIO.output(self.e_pin, GPIO.LOW)
        
        # Wait for command execution (from datasheet timing)
        if not is_data:
            if data in [self.CMD_CLEAR_DISPLAY, self.CMD_RETURN_HOME]:
                time.sleep(0.005)  # Clear/Home commands take longer
            else:
                time.sleep(0.001)  # Standard command execution time
        else:
            time.sleep(0.001)  # Character write time
    
    def _init_display(self):
        """Initialize LCD according to datasheet procedure"""
        print("Initializing LCD...")
        
        # Wait for power-on (datasheet specifies 15ms after Vdd reaches 4.5V)
        time.sleep(0.050)
        
        # Initial state - ensure everything is low
        GPIO.output(self.rs_pin, GPIO.LOW)
        GPIO.output(self.e_pin, GPIO.LOW)
        self._write_data_to_lcd(0x00)
        time.sleep(0.020)
        
        # 1) Function Set: 8-bit interface, 2 lines, 5x7 font
        # DL=1 (8-bit), N=1 (2-line), F=0 (5x7 dots)
        print("1. Function Set...")
        function_set_cmd = self.CMD_FUNCTION_SET | self.FUNC_8BIT | self.FUNC_2LINE | self.FUNC_5x8DOTS
        print(f"   Sending: 0x{function_set_cmd:02X}")
        self._write_8bits(function_set_cmd)
        time.sleep(0.010)
        
        # 2) Display Control: Display on, cursor off, blink off
        print("2. Display On...")
        display_on_cmd = self.CMD_DISPLAY_CONTROL | self.DISPLAY_ON
        print(f"   Sending: 0x{display_on_cmd:02X}")
        self._write_8bits(display_on_cmd)
        time.sleep(0.010)
        
        # 3) Clear display and cursor home
        print("3. Clear Display...")
        print(f"   Sending: 0x{self.CMD_CLEAR_DISPLAY:02X}")
        self._write_8bits(self.CMD_CLEAR_DISPLAY)
        time.sleep(0.010)
        
        print("LCD 1602A-1 initialized successfully")
    
    def clear(self):
        """Clear the display"""
        self._write_8bits(self.CMD_CLEAR_DISPLAY)
        time.sleep(0.005)  # Clear needs extra time
    
    def home(self):
        """Return cursor to home position (0,0)"""
        self._write_8bits(self.CMD_RETURN_HOME)
        time.sleep(0.005)  # Home needs extra time
    
    def set_cursor(self, col, row):
        """
        Set cursor position
        
        Args:
            col: Column (0-15)
            row: Row (0-1)
        """
        if row == 0:
            addr = self.LINE_1 + col
        elif row == 1:
            addr = self.LINE_2 + col
        else:
            return  # Invalid row
        
        self._write_8bits(self.CMD_SET_DDRAM_ADDR | addr)
    
    def write_char(self, char):
        """Write a single character at current cursor position"""
        self._write_8bits(ord(char), is_data=True)
    
    def write_string(self, text):
        """Write a string at current cursor position"""
        for char in text:
            if char == '\n':
                # Move to second line
                self.set_cursor(0, 1)
            else:
                self.write_char(char)
    
    def display_control(self, display=True, cursor=False, blink=False):
        """
        Control display, cursor, and blink settings
        
        Args:
            display: True to turn display on
            cursor: True to show cursor
            blink: True to enable cursor blinking
        """
        cmd = self.CMD_DISPLAY_CONTROL
        if display:
            cmd |= self.DISPLAY_ON
        if cursor:
            cmd |= self.CURSOR_ON
        if blink:
            cmd |= self.BLINK_ON
        
        self._write_8bits(cmd)
    
    def shift_display(self, right=True):
        """
        Shift entire display left or right
        
        Args:
            right: True to shift right, False to shift left
        """
        cmd = self.CMD_CURSOR_SHIFT | 0x08  # Display shift
        if right:
            cmd |= 0x04  # Right direction
        
        self._write_8bits(cmd)
    
    def create_char(self, location, pattern):
        """
        Create custom character
        
        Args:
            location: Character location (0-7)
            pattern: List of 8 bytes defining 5x8 character pattern
        """
        location &= 0x7  # Only 8 locations available
        self._write_8bits(self.CMD_SET_CGRAM_ADDR | (location << 3))
        
        for row in pattern:
            self._write_8bits(row, is_data=True)
    
    def write_line(self, line, text):
        """
        Write text to specific line
        
        Args:
            line: Line number (0 or 1)
            text: Text to write (max 16 characters)
        """
        self.set_cursor(0, line)
        # Pad or truncate text to 16 characters
        text = text[:16].ljust(16)
        self.write_string(text)
    
    def cleanup(self):
        """Clean up GPIO resources"""
        GPIO.cleanup()

# Simple test function
def test_lcd():
    """Test function demonstrating LCD usage"""
    print("Starting LCD test...")
    lcd = LCD1602A(i2c_addr=0x38, rs_pin=20, e_pin=21)
    
    try:
        # Test basic text display
        print("Writing test text...")
        lcd.clear()
        time.sleep(0.5)
        
        lcd.set_cursor(0, 0)
        lcd.write_string("Hello World!")
        
        lcd.set_cursor(0, 1)
        lcd.write_string("LCD Test 1602A")
        
        print("Text written, waiting...")
        time.sleep(5)
        
        # Test clearing
        print("Clearing display...")
        lcd.clear()
        time.sleep(2)
        
        # Test line by line
        print("Testing line writes...")
        lcd.write_line(0, "Line 0 Test")
        lcd.write_line(1, "Line 1 Test")
        time.sleep(3)
        
    except KeyboardInterrupt:
        print("\nTest interrupted")
    except Exception as e:
        print(f"Error during test: {e}")
    finally:
        lcd.cleanup()

if __name__ == "__main__":
    import socket
    lcd = LCD1602A()
    def get_ip():
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))  # Google DNS
        ip = s.getsockname()[0]
        s.close()
        return ip
    lcd.clear()

    # Get and display IP
    ip = get_ip()
    print(f"IP: {ip}")  # Debug print
    lcd.write_string(ip)  # Send to LCD
