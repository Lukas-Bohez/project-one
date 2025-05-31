#!/usr/bin/env python3

import spidev
import RPi.GPIO as GPIO
import time

# --- RC522 Register Definitions ---
COMMAND_REG      = 0x01
COMIEN_REG       = 0x02
DIVLRN_REG       = 0x03
COMIRO_REG       = 0x04
ERROR_REG        = 0x06
STATUS1_REG      = 0x07
STATUS2_REG      = 0x08
FIFO_DATA_REG    = 0x09
FIFO_LEVEL_REG   = 0x0A
CONTROL_REG      = 0x0C
BIT_FRAMING_REG  = 0x0D
MODE_REG         = 0x11
TX_CONTROL_REG   = 0x12
CRC_RESULT_REG_H = 0x21
CRC_RESULT_REG_L = 0x22
MOD_WIDTH_REG    = 0x24
RFC_CFG_REG      = 0x26
GS_N_REG         = 0x27
CW_CFG_REG       = 0x28
DEMOD_REG        = 0x2B
MIFARE_REG       = 0x2C
SERIAL_SPEED_REG = 0x2F

# Commands
IDLE_CMD         = 0x00
MEMORY_CMD       = 0x01
GENERATE_RANDOM_ID_CMD = 0x02
CALC_CRC_CMD     = 0x03
TRANSMIT_CMD     = 0x04
NO_CMD_CHANGE    = 0x07
RECEIVE_CMD      = 0x08
TRANSCEIVE_CMD   = 0x0C
MFAUTHENT_CMD    = 0x0E
SOFT_RESET_CMD   = 0x0F

# Status
MI_OK            = 0
MI_NOTAGERR      = 1
MI_ERR           = 2

# --- Hardcore RFID Class ---
class HardcoreRFID:
    def __init__(self, bus=0, device=0, speed=1000000, rst_pin=25):
        self.spi = spidev.SpiDev()
        self.spi.open(bus, device)
        self.spi.max_speed_hz = speed
        self.spi.mode = 0b00  # SPI Mode 0 (CPOL=0, CPHA=0)
        
        self.rst_pin = rst_pin
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.rst_pin, GPIO.OUT)
        GPIO.output(self.rst_pin, GPIO.HIGH)
        
        self._init_rc522()
    
    def _spi_write(self, address, value):
        # RC522 expects MSB first, bit 7 = 0 for write
        address = (address << 1) & 0x7E
        self.spi.xfer2([address, value])
    
    def _spi_read(self, address):
        # RC522 expects MSB first, bit 7 = 1 for read
        address = ((address << 1) & 0x7E) | 0x80
        return self.spi.xfer2([address, 0])[1]
    
    def _init_rc522(self):
        # Hard reset
        GPIO.output(self.rst_pin, GPIO.LOW)
        time.sleep(0.1)
        GPIO.output(self.rst_pin, GPIO.HIGH)
        time.sleep(0.1)
        
        # Configure RC522
        self._spi_write(MODE_REG, 0x3D)      # Define 106kHz modulation
        self._spi_write(RFC_CFG_REG, 0x7F)   # Set receiver gain
        self._spi_write(GS_N_REG, 0x50)      # Set antenna drive strength
        self._spi_write(CW_CFG_REG, 0x00)    # Disable CRC
        
        # Enable antenna
        self._spi_write(TX_CONTROL_REG, 0x03)
    
    def _wait_for_tag(self):
        self._spi_write(BIT_FRAMING_REG, 0x07)  # Enable RxLastBits
        self._spi_write(FIFO_LEVEL_REG, 0x80)   # Flush FIFO
        self._spi_write(COMMAND_REG, TRANSCEIVE_CMD)
        self._spi_write(FIFO_DATA_REG, 0x26)    # Send REQA (ISO14443A)
        
        start_time = time.time()
        while (time.time() - start_time) < 0.1:  # 100ms timeout
            status = self._spi_read(STATUS1_REG)
            if status & 0x08:  # RxIRq (Data received)
                return True
        return False
    
    def _get_uid(self):
        self._spi_write(BIT_FRAMING_REG, 0x00)
        self._spi_write(FIFO_LEVEL_REG, 0x80)   # Flush FIFO
        self._spi_write(COMMAND_REG, TRANSCEIVE_CMD)
        self._spi_write(FIFO_DATA_REG, 0x93)    # ANTICOLL (CL1)
        self._spi_write(FIFO_DATA_REG, 0x20)    # NVB (Number of Valid Bits)
        
        time.sleep(0.01)
        
        # Read response (4 bytes UID + BCC)
        uid = []
        for _ in range(5):
            uid.append(self._spi_read(FIFO_DATA_REG))
        
        return uid[:-1]  # Skip BCC (last byte)
    
    def read_card(self):
        if self._wait_for_tag():
            return self._get_uid()
        return None

# --- Main Execution ---
if __name__ == "__main__":
    try:
        print("Initializing Hardcore RFID Reader...")
        rfid = HardcoreRFID()
        print("Ready. Scan a card...")
        
        while True:
            uid = rfid.read_card()
            if uid:
                print(f"Card UID: {[hex(x) for x in uid]}")
                time.sleep(1)  # Debounce
            
    except KeyboardInterrupt:
        print("\nExiting...")
    finally:
        GPIO.cleanup()