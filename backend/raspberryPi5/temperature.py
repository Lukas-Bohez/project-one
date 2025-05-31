import os

class TemperatureSensor:
    def __init__(self, sensor_id=None):
        self.sensor_id = sensor_id or self._find_sensor()
        self.temp_file = f"/sys/bus/w1/devices/{self.sensor_id}/temperature"
        
    def _find_sensor(self):
        slaves_file = "/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves"
        if not os.path.exists(slaves_file):
            raise Exception("Geen 1-Wire apparaten gevonden.")
        
        with open(slaves_file, "r") as file:
            sensors = file.read().strip().split("\n")

        if not sensors or not sensors[0].startswith("28-"):
            raise Exception("Geen geldige temperatuur sensor gevonden.")
            
        return sensors[0]
    
    def read_temperature(self):
        with open(self.temp_file, "r") as file:
            temp_raw = file.read().strip()

        if not temp_raw:
            raise ValueError("Lege temperatuurwaarde ontvangen")
            
        return int(temp_raw) / 1000.0

if __name__ == "__main__":
    print("Temperature Sensor Example")
    print("--------------------------")
    
    try:
        # Create sensor instance
        sensor = TemperatureSensor()
        print(f"Initialized sensor with ID: {sensor.sensor_id}")
        
        # Read temperature
        temp = sensor.read_temperature()
        print(f"Current temperature: {temp:.2f} °C")
        
    except Exception as e:
        print(f"Error: {e}")
        print("\n* Since this is an example, here's simulated output *")
        print("Initialized sensor with ID: 28-00000abcdef1")
        print("Current temperature: 23.45 °C")
        