#!/usr/bin/env python3
import spidev
import RPi.GPIO as GPIO
import time

# RC522 Register Definitions
COMMAND_REG = 0x01
STATUS1_REG = 0x07
FIFO_DATA_REG = 0x09
FIFO_LEVEL_REG = 0x0A
BIT_FRAMING_REG = 0x0D
MODE_REG = 0x11
TX_CONTROL_REG = 0x12
RFC_CFG_REG = 0x26
GS_N_REG = 0x27
CW_CFG_REG = 0x28
TRANSCEIVE_CMD = 0x0C
IDLE_CMD = 0x00

class HardcoreRFID:
    def __init__(self, bus=0, device=0, speed=1000000, rst_pin=25):
        self.spi = spidev.SpiDev()
        self.spi.open(bus, device)
        self.spi.max_speed_hz = speed
        self.spi.mode = 0b00
        
        self.rst_pin = rst_pin
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.rst_pin, GPIO.OUT)
        GPIO.output(self.rst_pin, GPIO.HIGH)
        
        self._init_rc522()
        self.last_uid = None
        self.last_read_time = 0
    
    def _spi_write(self, address, value):
        address = (address << 1) & 0x7E
        self.spi.xfer2([address, value])
    
    def _spi_read(self, address):
        address = ((address << 1) & 0x7E) | 0x80
        return self.spi.xfer2([address, 0])[1]
    
    def _init_rc522(self):
        # Hardware reset
        GPIO.output(self.rst_pin, GPIO.LOW)
        time.sleep(0.1)
        GPIO.output(self.rst_pin, GPIO.HIGH)
        time.sleep(0.1)
        
        # Soft reset
        self._spi_write(COMMAND_REG, IDLE_CMD)
        time.sleep(0.1)
        
        # Configure RC522
        self._spi_write(MODE_REG, 0x3D)
        self._spi_write(RFC_CFG_REG, 0x7F)
        self._spi_write(GS_N_REG, 0x50)
        self._spi_write(CW_CFG_REG, 0x00)
        self._spi_write(TX_CONTROL_REG, 0x03)
        
        # Clear FIFO
        self._clear_fifo()
    
    def _clear_fifo(self):
        """Clear the FIFO buffer"""
        self._spi_write(FIFO_LEVEL_REG, 0x80)  # Flush FIFO
        self._spi_write(COMMAND_REG, IDLE_CMD)
    
    def _wait_for_tag(self):
        self._clear_fifo()
        self._spi_write(BIT_FRAMING_REG, 0x07)
        self._spi_write(COMMAND_REG, TRANSCEIVE_CMD)
        self._spi_write(FIFO_DATA_REG, 0x26)
        
        start_time = time.time()
        while (time.time() - start_time) < 0.1:
            status = self._spi_read(STATUS1_REG)
            if status & 0x08:  # Check if data received
                fifo_level = self._spi_read(FIFO_LEVEL_REG) & 0x7F
                if fifo_level > 0:
                    return True
        return False
    
    def _get_uid(self):
        self._clear_fifo()
        self._spi_write(BIT_FRAMING_REG, 0x00)
        self._spi_write(COMMAND_REG, TRANSCEIVE_CMD)
        self._spi_write(FIFO_DATA_REG, 0x93)  # ANTICOLL command
        self._spi_write(FIFO_DATA_REG, 0x20)
        
        # Wait for response
        start_time = time.time()
        while (time.time() - start_time) < 0.1:
            status = self._spi_read(STATUS1_REG)
            if status & 0x08:  # Data received
                fifo_level = self._spi_read(FIFO_LEVEL_REG) & 0x7F
                if fifo_level >= 5:  # Should have 4 UID bytes + 1 BCC
                    break
        else:
            return None
        
        # Read UID bytes
        uid = []
        for _ in range(4):  # Only read 4 bytes (ignore BCC)
            byte_val = self._spi_read(FIFO_DATA_REG)
            # Validate byte (should not be 0xFF unless it's a valid card)
            if byte_val == 0xFF:
                # Check if all bytes are 0xFF (invalid)
                remaining_bytes = []
                for _ in range(3 - len(uid)):
                    remaining_bytes.append(self._spi_read(FIFO_DATA_REG))
                if all(b == 0xFF for b in remaining_bytes):
                    return None
                uid.extend(remaining_bytes)
                break
            uid.append(byte_val)
        
        return uid if len(uid) == 4 else None
    
    def read_card(self):
        current_time = time.time()
        
        # Skip if we're in cooldown period
        if current_time - self.last_read_time < 3:
            return None
            
        if self._wait_for_tag():
            uid_bytes = self._get_uid()
            
            if uid_bytes is None:
                return None
            
            # Convert to decimal string
            uid_str = ''.join(f"{byte:02d}" for byte in uid_bytes)
            
            # Ignore all-zero UIDs or invalid patterns
            if uid_str == "00000000" or uid_str == "255255255255":
                return None
                
            # Only report if it's a new card or cooldown expired
            if uid_str != self.last_uid or (current_time - self.last_read_time) >= 3:
                self.last_uid = uid_str
                self.last_read_time = current_time
                
                # Clear the FIFO and stop communication to prevent repeated reads
                self._clear_fifo()
                self._spi_write(COMMAND_REG, IDLE_CMD)
                
                return uid_str
                
        return None

if __name__ == "__main__":
    try:
        print("RFID Reader Ready - Scan a card")
        rfid = HardcoreRFID()
        
        while True:
            uid = rfid.read_card()
            if uid:
                print(f"Card detected: {uid}")
            time.sleep(0.1)
            
    except KeyboardInterrupt:
        print("\nExiting...")
    finally:
        GPIO.cleanup()