import spidev
import time

class RFIDReader:
    def __init__(self, bus=0, device=0, speed_hz=1000000):
        self.spi = spidev.SpiDev()
        self.spi.open(bus, device)
        self.spi.max_speed_hz = speed_hz
        self.spi.mode = 0  # SPI Mode 0 (common for RFID)

    def read_rfid(self):
        """Read RFID tag (example for MFRC522-like modules)."""
        # Send a dummy read command (adjust based on your RFID module)
        response = self.spi.xfer2([0x30, 0x00])  # Example: READ command
        tag_id = "".join(f"{byte:02X}" for byte in response[1:5])  # Convert to hex
        return tag_id if tag_id != "00000000" else None

    def cleanup(self):
        self.spi.close()

class LightSensor:
    def __init__(self, bus=0, device=1, channel=0):
        self.spi = spidev.SpiDev()
        self.spi.open(bus, device)
        self.spi.max_speed_hz = 1000000
        self.spi.mode = 0  # MCP3008 uses SPI Mode 0
        self.channel = channel

    def read_adc(self):
        adc = self.spi.xfer2([1, (8 + self.channel) << 4, 0])
        return ((adc[1] & 0b11) << 8) + adc[2]

    def cleanup(self):
        self.spi.close()

if __name__ == "__main__":
    rfid = None
    light = None
    try:
        rfid = RFIDReader(device=0)  # CE0 (Pin 24)
        light = LightSensor(device=1) # CE1 (Pin 26)
        
        while True:
            # Read RFID
            tag = rfid.read_rfid()
            if tag:
                print(f"RFID Tag: {tag}")
            
            # Read light sensor
            lux = light.read_adc()
            print(f"Light ADC: {lux}")
            
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("Stopping...")
    finally:
        if rfid:
            rfid.cleanup()
        if light:
            light.cleanup()