import spidev
import time
import random
import math
from datetime import datetime
from enum import Enum

class LightScenario(Enum):
    NORMAL = 1
    CLOUD_COVER = 2
    SUNNY_DAY = 3
    NIGHT_TIME = 4
    SUNRISE_SUNSET = 5
    THUNDERSTORM = 6
    AURORA_BOREALIS = 7
    SOLAR_ECLIPSE = 8
    POWER_OUTAGE = 9
    ALIEN_ABDUCTION = 10
    LASER_LIGHT_SHOW = 11
    FIREWORKS = 12
    DISCO_PARTY = 13
    TIME_TRAVEL = 14
    DIMENSIONAL_RIFT = 15
    QUANTUM_FLUCTUATION = 16
    BLACKOUT = 17
    SUPERMOON = 18
    METEOR_SHOWER = 19
    FOREST_FIRE = 20

class LightSensor:
    def __init__(self, bus=0, device=1, channel=0, simulate=False):
        self.spi = None
        self.channel = channel
        self.max_adc = 1023
        self.initialized = False
        self.simulate = simulate
        self.last_simulated_value = 500
        self.last_update = time.time()
        
        # New variables for smooth light changes
        self.previous_lux = 500
        self.last_lux_update = time.time()
        self.max_rate_of_change = 1.0  # lux per 10ms (100 lux per second)
        self.target_lux = 500
        
        # Storytelling variables - made more extreme
        self.scenario = LightScenario.NORMAL
        self.scenario_start_time = 0
        self.scenario_duration = 0
        self.current_phase = 0
        self.total_phases = 1
        self.base_lux = 500
        self.story_told = False
        self.last_scenario_change = time.time()
        self.min_rest_period = 3  # Reduced from 10 seconds to 3 seconds
        self.scenario_probability = 0.02  # Increased from 0.002 to 0.02 (10x more likely)
        self.phase_duration = 15  # Reduced from 60 seconds to 15 seconds (4x faster)
        
        if not self.simulate:
            try:
                self.spi = spidev.SpiDev()
                self.spi.open(bus, device)
                self.spi.max_speed_hz = 1000000
                self.spi.mode = 0
                
                # Test read to verify sensor is connected
                test_value = self._read_hardware_adc()
                if test_value == 0:  # Likely no sensor connected
                    print("No sensor detected - switching to simulation mode")
                    self.simulate = True
                else:
                    self.initialized = True
                    print("Hardware sensor initialized successfully")
                
            except Exception as e:
                print(f"Hardware initialization failed: {e}")
                self.simulate = True
        else:
            print("Running in simulation mode by request")

    def _read_hardware_adc(self):
        """Read raw ADC value from hardware"""
        try:
            cmd = 0b11000000 | (self.channel << 4)
            adc = self.spi.xfer2([1, cmd, 0])
            return ((adc[1] & 0x03) << 8) | adc[2]
        except:
            return 0

    def _smooth_light_change(self, target_lux):
        current_time = time.time()
        time_elapsed = current_time - self.last_lux_update
        
        # Calculate maximum allowed change based on time elapsed
        max_change = self.max_rate_of_change * (time_elapsed * 100)  # Convert seconds to 10ms units
        
        # Gradually approach the target lux
        if abs(target_lux - self.previous_lux) <= max_change:
            new_lux = target_lux
        else:
            if target_lux > self.previous_lux:
                new_lux = self.previous_lux + max_change
            else:
                new_lux = self.previous_lux - max_change
                
        self.last_lux_update = current_time
        self.previous_lux = new_lux
        return new_lux

    def _select_scenario(self):
        current_time = time.time()
        
        # If we're in a rest period between scenarios
        if self.scenario == LightScenario.NORMAL and current_time - self.last_scenario_change < self.min_rest_period:
            return self.scenario
            
        # If we're in an active scenario and it's not finished
        if (self.scenario != LightScenario.NORMAL and 
            current_time - self.scenario_start_time < self.scenario_duration):
            # Check if we should advance to the next phase
            phase_time = (current_time - self.scenario_start_time) % self.phase_duration
            if phase_time < 0.1:  # Just started a new phase
                self.current_phase = min(self.current_phase + 1, self.total_phases)
            return self.scenario
            
        # Random chance to change scenario (only after rest period)
        if (self.scenario == LightScenario.NORMAL and 
            current_time - self.last_scenario_change >= self.min_rest_period and
            random.random() < self.scenario_probability):
            
            # Select a random scenario with weighted probabilities (increased weights for extreme scenarios)
            scenario_weights = {
                LightScenario.NORMAL: 0,
                LightScenario.CLOUD_COVER: 15,
                LightScenario.SUNNY_DAY: 15,
                LightScenario.NIGHT_TIME: 15,
                LightScenario.SUNRISE_SUNSET: 12,
                LightScenario.THUNDERSTORM: 10,  # Increased from 8
                LightScenario.AURORA_BOREALIS: 8,  # Increased from 5
                LightScenario.SOLAR_ECLIPSE: 6,  # Increased from 3
                LightScenario.POWER_OUTAGE: 10,  # Increased from 7
                LightScenario.ALIEN_ABDUCTION: 7,  # Increased from 4
                LightScenario.LASER_LIGHT_SHOW: 8,  # Increased from 5
                LightScenario.FIREWORKS: 9,  # Increased from 6
                LightScenario.DISCO_PARTY: 8,  # Increased from 5
                LightScenario.TIME_TRAVEL: 7,  # Increased from 4
                LightScenario.DIMENSIONAL_RIFT: 6,  # Increased from 3
                LightScenario.QUANTUM_FLUCTUATION: 7,  # Increased from 4
                LightScenario.BLACKOUT: 9,  # Increased from 6
                LightScenario.SUPERMOON: 10,  # Increased from 7
                LightScenario.METEOR_SHOWER: 9,  # Increased from 6
                LightScenario.FOREST_FIRE: 8  # Increased from 5
            }
            
            scenarios = list(scenario_weights.keys())
            weights = list(scenario_weights.values())
            self.scenario = random.choices(scenarios, weights=weights, k=1)[0]
            
            self.scenario_start_time = current_time
            self.current_phase = 1
            self.total_phases = random.randint(2, 6)  # Increased from 2-5 to 2-6
            self.scenario_duration = self.total_phases * self.phase_duration
            self.story_told = False
            self.last_scenario_change = current_time
            
        # If the scenario has ended, return to normal
        elif self.scenario != LightScenario.NORMAL:
            self.scenario = LightScenario.NORMAL
            self.scenario_start_time = current_time
            self.story_told = False
            
        return self.scenario

    def _simulate_adc(self):
        """Generate EXTREME light values with storytelling"""
        current_time = time.time()
        elapsed = current_time - self.scenario_start_time
        phase_progress = (elapsed % self.phase_duration) / self.phase_duration
        
        # Select and handle the current scenario
        self._select_scenario()
        
        # If we're in a normal period between scenarios
        if self.scenario == LightScenario.NORMAL:
            # Normal light with much larger fluctuations based on time of day
            current_hour = datetime.now().hour
            is_daytime = 6 <= current_hour < 18
            
            if is_daytime:
                base = random.randint(500, 950)
                fluctuation = random.uniform(-100, 100)  # Increased from -50,50
            else:
                base = random.randint(20, 150)  # Wider range
                fluctuation = random.uniform(-30, 30)  # Increased from -20,20
                if random.random() < 0.25:  # Increased chance
                    base += random.randint(300, 600)  # More extreme
            
            target = base + fluctuation
            step = (target - self.last_simulated_value) * 0.4  # Faster response
            self.last_simulated_value += step + random.uniform(-30, 30)  # More chaotic
            self.last_simulated_value = max(10, min(self.max_adc, self.last_simulated_value))  # Wider range
            
            return int(self.last_simulated_value)
            
        # Handle the different light scenarios with multiple phases - made more extreme
        if self.scenario == LightScenario.CLOUD_COVER:
            if not self.story_told:
                print(f"\n☁️  PHASE {self.current_phase}/{self.total_phases}: EXTREME cloud cover!")
                if self.current_phase == 1:
                    print("   Dense storm clouds blocking all light!")
                self.story_told = True
            
            cloud_density = 0.9 + 0.05 * (self.current_phase - 1)  # Darker clouds
            chaos = random.uniform(0.8, 1.2)  # Added chaos factor
            target_adc = int(self.max_adc * (0.1 + 0.15 * math.sin(phase_progress * 4 * math.pi)) * cloud_density * chaos)  # Faster oscillation
            
        elif self.scenario == LightScenario.SUNNY_DAY:
            if not self.story_told:
                print(f"\n☀️  PHASE {self.current_phase}/{self.total_phases}: BLINDING sunlight!")
                if self.current_phase == 1:
                    print("   Intense direct sunlight - wear protection!")
                self.story_told = True
            
            sun_intensity = 1.0 + 0.15 * (self.current_phase - 1)  # More intense
            chaos = random.uniform(0.9, 1.1)  # Added chaos factor
            target_adc = int(self.max_adc * (0.8 + 0.15 * math.sin(phase_progress * 2 * math.pi)) * sun_intensity * chaos)  # More extreme
            
        elif self.scenario == LightScenario.NIGHT_TIME:
            if not self.story_told:
                print(f"\n🌙 PHASE {self.current_phase}/{self.total_phases}: PITCH BLACK night!")
                if self.current_phase == 1:
                    print("   Complete darkness with only starlight.")
                self.story_told = True
            
            night_darkness = 0.95 - 0.05 * (self.current_phase - 1)  # Darker
            base_light = 20 + 15 * math.sin(phase_progress * math.pi)  # Lower base
            chaos = random.uniform(0.8, 1.2)  # Added chaos factor
            target_adc = int(base_light * night_darkness * chaos)
            
        elif self.scenario == LightScenario.SUNRISE_SUNSET:
            if not self.story_told:
                print(f"\n🌅 PHASE {self.current_phase}/{self.total_phases}: DRAMATIC sunrise/sunset!")
                if self.current_phase == 1:
                    print("   Intense color changes in the sky!")
                self.story_told = True
            
            if self.current_phase == 1:
                target_adc = int(self.max_adc * (0.2 + 0.7 * phase_progress))  # More dramatic
            elif self.current_phase == 2:
                chaos = random.uniform(0.9, 1.1)  # Added chaos factor
                target_adc = int(self.max_adc * (0.9 - 0.2 * math.sin(phase_progress * 4 * math.pi)) * chaos)  # Faster oscillation
            else:
                target_adc = int(self.max_adc * (0.7 - 0.6 * phase_progress))  # More dramatic
            
        elif self.scenario == LightScenario.THUNDERSTORM:
            if not self.story_told:
                print(f"\n⛈️  PHASE {self.current_phase}/{self.total_phases}: VIOLENT thunderstorm!")
                if self.current_phase == 1:
                    print("   Continuous lightning flashes!")
                self.story_told = True
            
            if random.random() < 0.25:  # Increased from 10% chance of lightning
                target_adc = self.max_adc
            else:
                storm_intensity = 0.9 - 0.1 * (self.current_phase - 1)  # More intense
                chaos = random.uniform(0.7, 1.3)  # Added chaos factor
                target_adc = int(self.max_adc * (0.1 + 0.08 * math.sin(phase_progress * 10 * math.pi)) * storm_intensity * chaos)  # Faster oscillation
            
        elif self.scenario == LightScenario.AURORA_BOREALIS:
            if not self.story_told:
                print(f"\n🌌 PHASE {self.current_phase}/{self.total_phases}: INTENSE aurora display!")
                if self.current_phase == 1:
                    print("   Brilliant northern lights filling the sky!")
                self.story_told = True
            
            aurora_intensity = 0.5 + 0.2 * (self.current_phase - 1)  # More intense
            pattern = (math.sin(phase_progress * 14 * math.pi) +  # Faster
                      0.7 * math.sin(phase_progress * 26 * math.pi))  # Faster
            chaos = random.uniform(0.8, 1.2)  # Added chaos factor
            target_adc = int(self.max_adc * (0.2 + 0.3 * abs(pattern)) * aurora_intensity * chaos)  # More extreme
            
        elif self.scenario == LightScenario.SOLAR_ECLIPSE:
            if not self.story_told:
                print(f"\n🌑 PHASE {self.current_phase}/{self.total_phases}: TOTAL solar eclipse!")
                if self.current_phase == 1:
                    print("   Complete darkness at midday!")
                self.story_told = True
            
            if self.current_phase == 1:
                target_adc = int(self.max_adc * (1.0 - 0.95 * phase_progress))  # More dramatic
            elif self.current_phase == 2:
                chaos = random.uniform(0.9, 1.1)  # Added chaos factor
                target_adc = int(self.max_adc * (0.05 + 0.08 * math.sin(phase_progress * 20 * math.pi)) * chaos)  # Faster oscillation
            else:
                target_adc = int(self.max_adc * (0.05 + 0.9 * phase_progress))  # More dramatic
            
        elif self.scenario == LightScenario.POWER_OUTAGE:
            if not self.story_told:
                print(f"\n💡 PHASE {self.current_phase}/{self.total_phases}: COMPLETE power outage!")
                if self.current_phase == 1:
                    print("   Total darkness with emergency failures!")
                self.story_told = True
            
            if self.current_phase == 1:
                target_adc = int(self.max_adc * (0.9 - 0.85 * phase_progress))  # More dramatic
            elif self.current_phase == 2:
                chaos = random.uniform(0.8, 1.2)  # Added chaos factor
                target_adc = int(self.max_adc * (0.05 + 0.03 * math.sin(phase_progress * 6 * math.pi)) * chaos)  # More extreme
            else:
                target_adc = int(self.max_adc * (0.08 + 0.85 * phase_progress))  # More dramatic
            
        elif self.scenario == LightScenario.ALIEN_ABDUCTION:
            if not self.story_told:
                print(f"\n👽 PHASE {self.current_phase}/{self.total_phases}: INTENSE alien beam!")
                if self.current_phase == 1:
                    print("   Blinding light from above!")
                self.story_told = True
            
            beam_intensity = 0.8 + 0.3 * (self.current_phase - 1)  # More intense
            pattern = (math.sin(phase_progress * 10 * math.pi) +  # Faster
                      0.9 * math.cos(phase_progress * 22 * math.pi))  # Faster
            chaos = random.uniform(0.7, 1.3)  # Added chaos factor
            target_adc = int(self.max_adc * (0.5 + 0.4 * abs(pattern)) * beam_intensity * chaos)  # More extreme
            
        elif self.scenario == LightScenario.LASER_LIGHT_SHOW:
            if not self.story_told:
                print(f"\n💫 PHASE {self.current_phase}/{self.total_phases}: INTENSE laser show!")
                if self.current_phase == 1:
                    print("   Blinding laser patterns everywhere!")
                self.story_told = True
            
            show_intensity = 0.8 + 0.2 * (self.current_phase - 1)  # More intense
            if random.random() < 0.35:  # Increased from 20% chance of laser burst
                target_adc = self.max_adc
            else:
                pattern = math.sin(phase_progress * 16 * math.pi)  # Faster
                chaos = random.uniform(0.8, 1.2)  # Added chaos factor
                target_adc = int(self.max_adc * (0.5 + 0.4 * abs(pattern)) * show_intensity * chaos)  # More extreme
        
        # Default fallback for other scenarios - made more extreme
        else:
            chaos = random.uniform(0.5, 1.5)  # Added chaos factor
            target_adc = int(self.max_adc * (0.3 + 0.4 * math.sin(phase_progress * 4 * math.pi)) * chaos)  # More extreme
        
        # Update the simulated ADC value
        step = (target_adc - self.last_simulated_value) * 0.4
        self.last_simulated_value += step
        self.last_simulated_value = max(10, min(self.max_adc, self.last_simulated_value))
        
        return int(self.last_simulated_value)

    def read_adc(self):
        """Read ADC with automatic fallback to simulation"""
        if self.simulate:
            return self._simulate_adc()
            
        try:
            value = self._read_hardware_adc()
            if value == 0:  # No sensor detected
                print("No sensor readings detected - switching to simulation")
                self.simulate = True
                return self._simulate_adc()
            return value
        except Exception as e:
            print(f"Read error: {e} - switching to simulation")
            self.simulate = True
            return self._simulate_adc()

    def adc_to_lux(self, adc_value):
        """Convert with more extreme scaling"""
        try:
            # Scale simulated values differently than hardware
            if self.simulate:
                # More extreme range for simulation
                target_lux = int((adc_value / self.max_adc) * 2000)  # Increased from 1000
            else:
                # For hardware, ensure we don't get stuck at low values
                adc_value = max(adc_value, 10)
                target_lux = int((adc_value / self.max_adc) * 2000)  # Increased from 1000
            
            # Apply smoothing to the lux conversion
            return self._smooth_light_change(target_lux)
        except:
            return self._smooth_light_change(random.randint(10, 2000))  # Wider range

    def __call__(self):
        return self.adc_to_lux(self.read_adc())

    def cleanup(self):
        if self.spi:
            try:
                self.spi.close()
            except:
                pass

if __name__ == "__main__":
    sensor = None
    try:
        print("Initializing EXTREME light sensor...")
        # Start in hardware mode but allow auto-fallback to simulation
        sensor = LightSensor(device=1, simulate=False)
        
        print(f"Current mode: {'SIMULATION' if sensor.simulate else 'HARDWARE'}")
        print("EXTREME Light Storytelling Sensor Active - Brace for WILD light narratives!")
        print("Press Ctrl+C to stop...")
        
        while True:
            lux = sensor()
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] Light: {lux:.1f} lux", end='\r', flush=True)
            time.sleep(0.01)  # Reduced sleep time for smoother updates
            
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        if sensor:
            sensor.cleanup()