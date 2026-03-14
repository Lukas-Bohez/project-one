import random
import time
from datetime import datetime


class TemperatureSensor:
    def __init__(self):
        # base and stateful simulation params
        self.base_temperature = 20.0
        self.min_temp = 15.0
        self.max_temp = 30.0
        self.temp_step = 0.1  # change ~0.1°C when it changes
        self.change_prob = 0.7  # chance to change per read
        self._temp_current = float(self.base_temperature)

    def read_temperature(self):
        """Return a temperature that drifts slowly by small steps.

        - Each call has a `change_prob` chance to move up or down by `temp_step`.
        - Value is clamped to `min_temp`..`max_temp`.
        """
        if random.random() < self.change_prob:
            direction = random.choice((-1, 1))
            self._temp_current += direction * self.temp_step
            self._temp_current = max(
                self.min_temp, min(self.max_temp, self._temp_current)
            )

        # occasional small nudge toward the center to avoid sticking at edges
        if random.random() < 0.12:
            center = (self.min_temp + self.max_temp) / 2.0
            # move a small fraction (5%) toward center
            nudge = (center - self._temp_current) * 0.05
            self._temp_current += nudge
            self._temp_current = max(
                self.min_temp, min(self.max_temp, self._temp_current)
            )

        # tiny jitter so readings don't look perfectly discretized
        jitter = random.uniform(-0.02, 0.02)
        return round(self._temp_current + jitter, 2)


if __name__ == "__main__":
    print("Simple Temperature Sensor")
    print("------------------------")
    print("Random temperatures between -10°C and 50°C")
    print()

    sensor = TemperatureSensor()

    try:
        while True:
            temp = sensor.read_temperature()
            display_temp = f"{temp:.2f} °C"
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] Temperature: {display_temp}", end="\r", flush=True)
            time.sleep(0.2)  # human-friendly update interval

    except KeyboardInterrupt:
        print("\n\nExiting temperature sensor...")
