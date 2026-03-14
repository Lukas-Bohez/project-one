import random
import time
from datetime import datetime


class LightSensor:
    def __init__(
        self, bus=0, device=1, channel=0, simulate=True
    ):  # Always simulate for Windows
        """Light sensor simulator.

        Signature preserved (bus, device, channel, simulate) so other scripts
        that instantiate this class continue to work unchanged.
        """
        self.bus = bus
        self.device = device
        self.channel = channel
        self.simulate = simulate
        self.max_adc = 1023
        # stateful simulation parameters (tweakable after instantiation)
        self.min_lux = 0.0
        self.max_lux = 1000.0
        self.lux_step = 1.0  # change by ~1 lux per update when it changes
        self.change_prob = 0.6  # probability that value changes on each call
        # starting value
        self._lux_current = random.uniform(self.min_lux + 20, self.max_lux - 20)
        self._start_time = time.time()

    def _simulate_adc(self):
        """Stateful ADC simulator: current lux changes slowly by steps.

        Behavior:
        - On each call there is a `change_prob` chance the sensor value moves by
            one step (`lux_step`) up or down.
        - Values are clamped to `min_lux`..`max_lux`.
        - The returned ADC value is the integer-mapped representation of lux.
        """
        # decide whether to change this call
        if self.simulate and random.random() < self.change_prob:
            direction = random.choice((-1, 1))
            self._lux_current += direction * self.lux_step
            # small occasional nudges toward center to avoid sticking at edges
            self._lux_current = max(self.min_lux, min(self.max_lux, self._lux_current))

        # convert lux to ADC value
        value_norm = (self._lux_current - self.min_lux) / max(
            1e-6, (self.max_lux - self.min_lux)
        )
        adc_value = int(value_norm * self.max_adc)
        return max(0, min(self.max_adc, adc_value))

    def read_adc(self):
        """Read ADC with simulation"""
        return self._simulate_adc()

    def adc_to_lux(self, adc_value):
        """Convert ADC to lux"""
        try:
            # Convert ADC to lux (0-1000 range)
            return (adc_value / self.max_adc) * 1000
        except Exception as e:
            return random.uniform(0, 1000)

    def __call__(self):
        return self.adc_to_lux(self.read_adc())

    def cleanup(self):
        # No hardware to clean up
        pass


if __name__ == "__main__":
    sensor = LightSensor(device=1, simulate=True)
    print("Light sensor demo  press Ctrl+C to stop")
    print("--------------------------------------")
    print()

    try:
        while True:
            lux = sensor()
            timestamp = datetime.now().strftime("%H:%M:%S")
            # print a single tidy line that updates in-place
            print(f"[{timestamp}] Ambient light: {lux:.1f} lux", end="\r", flush=True)
            time.sleep(0.2)  # human-friendly update interval

    except KeyboardInterrupt:
        print("\nStopping light sensor demo...")
    finally:
        sensor.cleanup()
