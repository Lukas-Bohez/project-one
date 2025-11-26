import time
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
        self.initialized = True  # Always initialized for simulation
        self.display_content = ["", ""]  # Simulate two lines
    
    def _write_data_to_lcd(self, data):
        """Simulate writing data"""
        pass
    
    def _pulse_enable(self):
        """Simulate pulse enable"""
        pass
    
    def _write_8bits(self, data, is_data=False):
        """Simulate writing 8-bit command or data"""
        pass
    
    def _init_display(self):
        """Simulate initialize display"""
        pass
    
    def clear(self):
        """Simulate clear display"""
        self.display_content = ["", ""]
        print("LCD: Cleared")
    
    def home(self):
        """Simulate return cursor home"""
        print("LCD: Home")
    
    def set_cursor(self, col, row):
        """Simulate set cursor position"""
        pass
    
    def write_char(self, char):
        """Simulate write character"""
        pass
    
    def write_string(self, text):
        """Simulate write string"""
        print(f"LCD: {text}")
    
    def write_line(self, line, text):
        """Simulate write to specific line"""
        self.display_content[line] = text[:16].ljust(16)
        print(f"LCD Line {line}: {self.display_content[line]}")
    
    def cleanup(self):
        """Simulate clean up resources"""
        print("LCD: Cleanup")

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