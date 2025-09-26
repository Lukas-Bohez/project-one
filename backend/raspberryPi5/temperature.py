import os
import time
import random
import math
from enum import Enum
from datetime import datetime

class TemperatureScenario(Enum):
    NORMAL = 1
    COLD_SNAP = 2
    HEAT_WAVE = 3
    SUN_EXPLOSION = 4
    ABSOLUTE_ZERO = 5
    ICE_AGE = 6
    VOLCANIC_ERUPTION = 7
    METEOR_IMPACT = 8
    TIME_TRAVEL = 9
    ALIEN_INTERVENTION = 10
    DIMENSIONAL_RIFT = 11
    QUANTUM_FLUCTUATION = 12
    OCEAN_CURRENT_SHIFT = 13
    GEOTHERMAL_ACTIVITY = 14
    SOLAR_FLARE = 15
    CLOUD_COVER_DISSIPATION = 16
    ATMOSPHERIC_COMPRESSION = 17
    BIOLOGICAL_HEATING = 18
    ANTARCTIC_VORTEX_COLLAPSE = 19
    DEEP_SPACE_EXPOSURE = 20

class TemperatureSensor:
    def __init__(self):
        self.scenario = TemperatureScenario.NORMAL
        self.scenario_start_time = 0
        self.scenario_duration = 0
        self.current_phase = 0
        self.total_phases = 1
        self.base_temperature = 20.0
        self.story_told = False
        self.last_scenario_change = time.time()
        self.min_rest_period = 3  # Reduced from 10 seconds to 3 seconds
        self.scenario_probability = 0.02  # Increased from 0.002 to 0.02 (10x more likely)
        self.phase_duration = 15  # Reduced from 60 seconds to 15 seconds (4x faster)
        
        # New variables for smooth temperature changes
        self.previous_temperature = self.base_temperature
        self.last_temperature_update = time.time()
        self.max_rate_of_change = 0.01  # °C per 10ms (1°C per second)
        self.target_temperature = self.base_temperature
        
    def _smooth_temperature_change(self, target_temp):
        current_time = time.time()
        time_elapsed = current_time - self.last_temperature_update
        
        # Calculate maximum allowed change based on time elapsed
        max_change = self.max_rate_of_change * (time_elapsed * 100)  # Convert seconds to 10ms units
        
        # Gradually approach the target temperature
        if abs(target_temp - self.previous_temperature) <= max_change:
            new_temp = target_temp
        else:
            if target_temp > self.previous_temperature:
                new_temp = self.previous_temperature + max_change
            else:
                new_temp = self.previous_temperature - max_change
                
        self.last_temperature_update = current_time
        self.previous_temperature = new_temp
        return new_temp
    
    def _select_scenario(self):
        current_time = time.time()
        
        # If we're in a rest period between scenarios
        if self.scenario == TemperatureScenario.NORMAL and current_time - self.last_scenario_change < self.min_rest_period:
            return self.scenario
            
        # If we're in an active scenario and it's not finished
        if (self.scenario != TemperatureScenario.NORMAL and 
            current_time - self.scenario_start_time < self.scenario_duration):
            # Check if we should advance to the next phase
            phase_time = (current_time - self.scenario_start_time) % self.phase_duration
            if phase_time < 0.1:  # Just started a new phase
                self.current_phase = min(self.current_phase + 1, self.total_phases)
            return self.scenario
            
        # Random chance to change scenario (only after rest period)
        if (self.scenario == TemperatureScenario.NORMAL and 
            current_time - self.last_scenario_change >= self.min_rest_period and
            random.random() < self.scenario_probability):
            
            # Select a random scenario with weighted probabilities
            scenario_weights = {
                TemperatureScenario.NORMAL: 0,
                TemperatureScenario.COLD_SNAP: 10,
                TemperatureScenario.HEAT_WAVE: 10,
                TemperatureScenario.SUN_EXPLOSION: 5,  # Increased from 2
                TemperatureScenario.ABSOLUTE_ZERO: 5,  # Increased from 2
                TemperatureScenario.ICE_AGE: 8,
                TemperatureScenario.VOLCANIC_ERUPTION: 8,  # Increased from 7
                TemperatureScenario.METEOR_IMPACT: 6,  # Increased from 3
                TemperatureScenario.TIME_TRAVEL: 7,  # Increased from 5
                TemperatureScenario.ALIEN_INTERVENTION: 6,  # Increased from 4
                TemperatureScenario.DIMENSIONAL_RIFT: 6,  # Increased from 3
                TemperatureScenario.QUANTUM_FLUCTUATION: 7,  # Increased from 4
                TemperatureScenario.OCEAN_CURRENT_SHIFT: 6,
                TemperatureScenario.GEOTHERMAL_ACTIVITY: 7,
                TemperatureScenario.SOLAR_FLARE: 7,  # Increased from 5
                TemperatureScenario.CLOUD_COVER_DISSIPATION: 6,
                TemperatureScenario.ATMOSPHERIC_COMPRESSION: 6,  # Increased from 3
                TemperatureScenario.BIOLOGICAL_HEATING: 6,  # Increased from 4
                TemperatureScenario.ANTARCTIC_VORTEX_COLLAPSE: 7,  # Increased from 5
                TemperatureScenario.DEEP_SPACE_EXPOSURE: 6  # Increased from 3
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
        elif self.scenario != TemperatureScenario.NORMAL:
            self.scenario = TemperatureScenario.NORMAL
            self.scenario_start_time = current_time
            self.story_told = False
            
        return self.scenario
    
    def _get_scenario_temperature(self):
        current_time = time.time()
        elapsed = current_time - self.scenario_start_time
        phase_progress = (elapsed % self.phase_duration) / self.phase_duration
        
        # If we're in a normal period between scenarios
        if self.scenario == TemperatureScenario.NORMAL:
            # Normal temperature with much larger fluctuations
            chaos_factor = 10.0  # Increased from 0.5
            target_temp = self.base_temperature + random.uniform(-chaos_factor, chaos_factor)
            return self._smooth_temperature_change(target_temp)
            
        # Handle the different scenarios with multiple phases
        if self.scenario == TemperatureScenario.COLD_SNAP:
            if not self.story_told:
                print(f"\n❄️  PHASE {self.current_phase}/{self.total_phases}: Arctic cold front approaching!")
                if self.current_phase == 1:
                    print("   Initial temperature drop detected. Preparing for extended cold period.")
                self.story_told = True
            
            if self.current_phase == 1:
                target_temp = self.base_temperature - 50.0 * phase_progress  # Increased from 10.0
            elif self.current_phase == 2:
                target_temp = self.base_temperature - 50.0 - 25.0 * phase_progress  # Increased from 10.0 and 5.0
            else:
                target_temp = self.base_temperature - 75.0 + 10.0 * math.sin(phase_progress * 8 * math.pi)  # Increased from 15.0 and 2.0
            
        elif self.scenario == TemperatureScenario.HEAT_WAVE:
            if not self.story_told:
                print(f"\n🔥 PHASE {self.current_phase}/{self.total_phases}: Heat wave building!")
                if self.current_phase == 1:
                    print("   High pressure system settling in. Temperatures rising steadily.")
                self.story_told = True
            
            if self.current_phase == 1:
                target_temp = self.base_temperature + 60.0 * phase_progress  # Increased from 12.0
            elif self.current_phase == 2:
                target_temp = self.base_temperature + 60.0 + 15.0 * math.sin(phase_progress * 4 * math.pi)  # Increased from 12.0
            else:
                peak_heat = 75.0 + 15.0 * (self.current_phase - 2)  # Increased from 15.0 and 3.0
                target_temp = self.base_temperature + peak_heat - 10.0 * phase_progress  # Increased from 2.0
            
        elif self.scenario == TemperatureScenario.SUN_EXPLOSION:
            if not self.story_told:
                print(f"\n☀️  PHASE {self.current_phase}/{self.total_phases}: SOLAR CATASTROPHE!")
                if self.current_phase == 1:
                    print("   Extreme UV radiation detected. Sun showing instability signs.")
                self.story_told = True
            
            if self.current_phase == 1:
                target_temp = self.base_temperature + 2000.0 * phase_progress  # Increased from 500.0
            elif self.current_phase == 2:
                target_temp = self.base_temperature + 2000.0 + 800.0 * math.sin(phase_progress * math.pi)  # Increased from 500.0 and 200.0
            else:
                target_temp = self.base_temperature + 1200.0 - 1120.0 * (phase_progress ** 0.5)  # Increased from 300.0 and 280.0
            
        elif self.scenario == TemperatureScenario.ABSOLUTE_ZERO:
            if not self.story_told:
                print(f"\n❄️  PHASE {self.current_phase}/{self.total_phases}: QUANTUM COOLING EVENT!")
                if self.current_phase == 1:
                    print("   Entropy reversal detected. Molecular motion slowing dramatically.")
                self.story_told = True
            
            if self.current_phase == 1:
                target_temp = self.base_temperature - 1000.0 * phase_progress  # Increased from 250.0
            elif self.current_phase == 2:
                target_temp = -273.0 + 2.0 * math.sin(phase_progress * 8 * math.pi)  # Increased from 0.5
            else:
                target_temp = -272.5 + 6.0 * phase_progress  # Increased from 1.5
            
        elif self.scenario == TemperatureScenario.ICE_AGE:
            if not self.story_told:
                print(f"\n🏔️  PHASE {self.current_phase}/{self.total_phases}: ICE AGE INITIATION!")
                if self.current_phase == 1:
                    print("   Global cooling trend detected. Glaciers beginning to form.")
                self.story_told = True
            
            cooling = 100.0 + 20.0 * (self.current_phase - 1)  # Increased from 30.0 and 5.0
            target_temp = self.base_temperature - cooling * (0.8 + 0.2 * math.sin(phase_progress * 4 * math.pi))  # Increased frequency
            
        elif self.scenario == TemperatureScenario.VOLCANIC_ERUPTION:
            if not self.story_told:
                print(f"\n🌋 PHASE {self.current_phase}/{self.total_phases}: MAJOR VOLCANIC EVENT!")
                if self.current_phase == 1:
                    print("   Pyroclastic flow detected. Ash cloud affecting temperatures.")
                self.story_told = True
            
            if self.current_phase == 1:
                target_temp = self.base_temperature + 320.0 * phase_progress  # Increased from 80.0
            elif self.current_phase == 2:
                target_temp = self.base_temperature + 320.0 - 80.0 * phase_progress  # Increased from 80.0 and 20.0
            else:
                target_temp = self.base_temperature + 240.0 - 220.0 * (phase_progress ** 0.7)  # Increased from 60.0 and 55.0
            
        elif self.scenario == TemperatureScenario.METEOR_IMPACT:
            if not self.story_told:
                print(f"\n💥 PHASE {self.current_phase}/{self.total_phases}: METEOR IMPACT EVENT!")
                if self.current_phase == 1:
                    print("   Large object entering atmosphere. Impact imminent!")
                self.story_told = True
            
            if self.current_phase == 1:
                target_temp = self.base_temperature + 600.0 * phase_progress  # Increased from 150.0
            elif self.current_phase == 2:
                target_temp = self.base_temperature + 600.0 - 400.0 * phase_progress  # Increased from 150.0 and 100.0
            else:
                target_temp = self.base_temperature + 200.0 - 260.0 * (phase_progress ** 0.5)  # Increased from 50.0 and 65.0
            
        elif self.scenario == TemperatureScenario.TIME_TRAVEL:
            if not self.story_told:
                print(f"\n⏰ PHASE {self.current_phase}/{self.total_phases}: TEMPORAL DISPLACEMENT!")
                if self.current_phase == 1:
                    print("   Chronometric particles detected. Time stream instability.")
                self.story_told = True
            
            era_mod = (self.current_phase * 3 + int(phase_progress * 10)) % 6
            if era_mod == 0:  # Prehistoric
                target_temp = 70.0 + 20.0 * math.sin(phase_progress * 4 * math.pi)  # Increased from 35.0 and 5.0
            elif era_mod == 1:  # Ice age
                target_temp = -60.0 + 12.0 * math.sin(phase_progress * 4 * math.pi)  # Increased from -15.0 and 3.0
            elif era_mod == 2:  # Medieval warm period
                target_temp = 44.0 + 8.0 * math.sin(phase_progress * 4 * math.pi)  # Increased from 22.0 and 2.0
            elif era_mod == 3:  # Little ice age
                target_temp = 24.0 + 8.0 * math.sin(phase_progress * 4 * math.pi)  # Increased from 12.0 and 2.0
            elif era_mod == 4:  # Future climate
                target_temp = 56.0 + 16.0 * math.sin(phase_progress * 4 * math.pi)  # Increased from 28.0 and 4.0
            else:  # Present day
                target_temp = self.base_temperature + 8.0 * math.sin(phase_progress * 4 * math.pi)  # Increased from 2.0
                
        elif self.scenario == TemperatureScenario.ALIEN_INTERVENTION:
            if not self.story_told:
                print(f"\n👽 PHASE {self.current_phase}/{self.total_phases}: EXTRATERRESTRIAL INFLUENCE!")
                if self.current_phase == 1:
                    print("   Unknown energy signatures. Advanced technology detected.")
                self.story_told = True
            
            pattern = (math.sin(phase_progress * 16 * math.pi) + 
                      0.5 * math.sin(phase_progress * 26 * math.pi) +
                      0.3 * math.cos(phase_progress * 54 * math.pi))  # Increased frequencies
            target_temp = self.base_temperature + 100.0 * pattern * (self.current_phase / self.total_phases)  # Increased from 25.0
            
        elif self.scenario == TemperatureScenario.DIMENSIONAL_RIFT:
            if not self.story_told:
                print(f"\n🌀 PHASE {self.current_phase}/{self.total_phases}: DIMENSIONAL INSTABILITY!")
                if self.current_phase == 1:
                    print("   Reality fabric weakening. Multiple dimensions overlapping.")
                self.story_told = True
            
            if random.random() < 0.25:  # Increased from 10% chance of extreme value
                target_temp = random.choice([-5000, 10000, float('nan'), float('inf')])  # More extreme values
            else:
                target_temp = self.base_temperature + random.uniform(-200, 200) * self.current_phase  # Increased range
            
        elif self.scenario == TemperatureScenario.QUANTUM_FLUCTUATION:
            if not self.story_told:
                print(f"\n⚛️  PHASE {self.current_phase}/{self.total_phases}: QUANTUM ANOMALY!")
                if self.current_phase == 1:
                    print("   Probability waves collapsing erratically. Reality uncertain.")
                self.story_told = True
            
            if random.random() < 0.3:  # Increased from 15% chance of quantum weirdness
                target_temp = random.choice([-273.15, 50000, float('nan'), float('inf'), -float('inf')])  # More extreme values
            else:
                quantum_effect = math.sin(phase_progress * 14 * math.pi) * math.cos(phase_progress * 22 * math.pi)  # Increased frequencies
                target_temp = self.base_temperature + 60.0 * quantum_effect * self.current_phase  # Increased from 15.0
        
        # Additional scenarios with similar detailed implementations
        elif self.scenario == TemperatureScenario.OCEAN_CURRENT_SHIFT:
            if not self.story_told:
                print(f"\n🌊 PHASE {self.current_phase}/{self.total_phases}: OCEAN CURRENT DISRUPTION!")
                self.story_told = True
            target_temp = self.base_temperature - 32.0 * self.current_phase * (0.7 + 0.3 * math.sin(phase_progress * 6 * math.pi))  # Increased from 8.0
        
        elif self.scenario == TemperatureScenario.GEOTHERMAL_ACTIVITY:
            if not self.story_told:
                print(f"\n🌋 PHASE {self.current_phase}/{self.total_phases}: GEOTHERMAL UPHEAVAL!")
                self.story_told = True
            target_temp = self.base_temperature + 48.0 * self.current_phase * (0.6 + 0.4 * math.sin(phase_progress * 10 * math.pi))  # Increased from 12.0
        
        elif self.scenario == TemperatureScenario.SOLAR_FLARE:
            if not self.story_told:
                print(f"\n☀️  PHASE {self.current_phase}/{self.total_phases}: SOLAR STORM!")
                self.story_told = True
            flare_intensity = 2.0 + 1.0 * self.current_phase  # Increased from 1.0 and 0.5
            target_temp = self.base_temperature + 100.0 * flare_intensity * math.sin(phase_progress * 4 * math.pi)  # Increased from 25.0
        
        # Default fallback with extreme fluctuations
        else:
            chaos_factor = 50.0 * self.current_phase
            target_temp = self.base_temperature + random.uniform(-chaos_factor, chaos_factor)
        
        # Apply smoothing to all temperature changes
        return self._smooth_temperature_change(target_temp)
    
    def read_temperature(self):
        self._select_scenario()
        return self._get_scenario_temperature()

if __name__ == "__main__":
    print("EXTREME Storytelling Temperature Sensor")
    print("----------------------------------------")
    print("This sensor tells WILD stories through DRAMATIC temperature fluctuations.")
    print("Each event has multiple phases lasting about 15 seconds each.")
    print("Brace for EXTREME events and CRAZY temperature narratives!")
    print()
    
    sensor = TemperatureSensor()
    
    try:
        while True:
            temp = sensor.read_temperature()
            
            # Handle special temperature values
            if math.isnan(temp):
                display_temp = "NaN (Not a Number)"
            elif math.isinf(temp):
                display_temp = "Infinity" if temp > 0 else "-Infinity"
            else:
                display_temp = f"{temp:.2f} °C"
            
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] Temperature: {display_temp}", end='\r')
            time.sleep(0.01)  # Reduced sleep time for smoother updates
            
    except KeyboardInterrupt:
        print("\n\nExiting EXTREME temperature storytelling experience...")