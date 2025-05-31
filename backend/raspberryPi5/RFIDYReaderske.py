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
        GPIO.output(self.rst_pin, GPIO.LOW)
        time.sleep(0.1)
        GPIO.output(self.rst_pin, GPIO.HIGH)
        time.sleep(0.1)
        
        self._spi_write(MODE_REG, 0x3D)
        self._spi_write(RFC_CFG_REG, 0x7F)
        self._spi_write(GS_N_REG, 0x50)
        self._spi_write(CW_CFG_REG, 0x00)
        self._spi_write(TX_CONTROL_REG, 0x03)
    
    def _wait_for_tag(self):
        self._spi_write(BIT_FRAMING_REG, 0x07)
        self._spi_write(FIFO_LEVEL_REG, 0x80)
        self._spi_write(COMMAND_REG, TRANSCEIVE_CMD)
        self._spi_write(FIFO_DATA_REG, 0x26)
        
        start_time = time.time()
        while (time.time() - start_time) < 0.1:
            status = self._spi_read(STATUS1_REG)
            if status & 0x08:
                return True
        return False
    
    def _get_uid(self):
        self._spi_write(BIT_FRAMING_REG, 0x00)
        self._spi_write(FIFO_LEVEL_REG, 0x80)
        self._spi_write(COMMAND_REG, TRANSCEIVE_CMD)
        self._spi_write(FIFO_DATA_REG, 0x93)
        self._spi_write(FIFO_DATA_REG, 0x20)
        
        time.sleep(0.01)
        
        uid = []
        for _ in range(4):  # Only read 4 bytes (ignore BCC)
            uid.append(self._spi_read(FIFO_DATA_REG))
        
        return uid
    
    def read_card(self):
        current_time = time.time()
        
        # Skip if we're in cooldown period
        if current_time - self.last_read_time < 15:
            return None
            
        if self._wait_for_tag():
            uid_bytes = self._get_uid()
            
            # Convert to decimal string
            uid_str = ''.join(f"{byte:02d}" for byte in uid_bytes)
            
            # Ignore all-zero UIDs
            if uid_str == "00000000":
                return None
                
            # Only report if it's a new card or cooldown expired
            if uid_str != self.last_uid:
                self.last_uid = uid_str
                self.last_read_time = current_time
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