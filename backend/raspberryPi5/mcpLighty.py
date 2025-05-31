import spidev
import time

class LightSensor:
    def __init__(self, bus=0, device=1, channel=0):
        self.spi = spidev.SpiDev()
        self.spi.open(bus, device)
        self.spi.max_speed_hz = 1000000
        self.spi.mode = 0
        self.channel = channel
        self.max_adc = 1023  # MCP3008 is 10-bit (0-1023)

    def read_adc(self):
        adc = self.spi.xfer2([1, (8 + self.channel) << 4, 0])
        return ((adc[1] & 0b11) << 8) + adc[2]

    def adc_to_lux(self, adc_value):
        """Invert ADC and scale to lux (higher lux = more light)."""
        inverted_adc = self.max_adc - adc_value  # Fix inverse behavior!
        max_lux = 1000  # Adjust based on your sensor's max brightness
        return (inverted_adc / self.max_adc) * max_lux

    def __call__(self):
        return self.adc_to_lux(self.read_adc())

    def cleanup(self):
        self.spi.close()

if __name__ == "__main__":
    sensor = None
    try:
        sensor = LightSensor(device=1)  # CE1 (Pin 26)
        while True:
            lux = sensor()
            raw_adc = sensor.read_adc()
            print(f"Light: {lux:.2f} lux | Raw ADC: {raw_adc} (Inverted: {1023 - raw_adc})")
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping...")
    finally:
        if sensor:
            sensor.cleanup()