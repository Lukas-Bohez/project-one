# temperature.py
import time

import usb.core
import usb.util


class TemperatureSensor:
    def __init__(self, vendor_id=0x0C45, product_id=0x7401):
        """
        Initialize the TEMPer USB temperature sensor.

        Args:
            vendor_id (int): USB vendor ID (default: 0x0c45 for TEMPer devices)
            product_id (int): USB product ID (default: 0x7401 for TEMPer devices)
        """
        self.vendor_id = vendor_id
        self.product_id = product_id
        self.device = None
        self.interface = 0
        self._connect()

    def _connect(self):
        """Find and configure the USB device."""
        # Find the device
        self.device = usb.core.find(idVendor=self.vendor_id, idProduct=self.product_id)

        if self.device is None:
            raise ValueError(
                "Temperature sensor not found. Please check the device is connected."
            )

        # Detach kernel driver if active
        if self.device.is_kernel_driver_active(self.interface):
            self.device.detach_kernel_driver(self.interface)

        # Set configuration
        self.device.set_configuration()

        # Claim interface
        usb.util.claim_interface(self.device, self.interface)

    def _send_command(self, command):
        """Send a command to the device and read the response."""
        try:
            # Write command
            self.device.write(0x02, command, timeout=1000)

            # Read response
            time.sleep(0.1)  # Small delay for device to process
            response = self.device.read(0x82, 8, timeout=1000)
            return response

        except usb.core.USBError as e:
            raise Exception(f"USB communication error: {e}")

    def read_temperature(self):
        """
        Read temperature from the sensor.

        Returns:
            float: Temperature in Celsius
        """
        try:
            # Command to request temperature reading
            command = [0x01, 0x80, 0x33, 0x01, 0x00, 0x00, 0x00, 0x00]
            response = self._send_command(command)

            # Convert response to temperature
            if response and len(response) >= 4:
                # Temperature calculation for TEMPer devices
                temp_c = (response[2] + response[3] * 256) / 100.0
                return temp_c
            else:
                raise Exception("Invalid response from temperature sensor")

        except Exception as e:
            # Try to reconnect and retry once
            try:
                self._disconnect()
                self._connect()
                command = [0x01, 0x80, 0x33, 0x01, 0x00, 0x00, 0x00, 0x00]
                response = self._send_command(command)

                if response and len(response) >= 4:
                    temp_c = (response[2] + response[3] * 256) / 100.0
                    return temp_c
                else:
                    raise Exception("Invalid response after reconnection")

            except Exception as retry_error:
                raise Exception(f"Failed to read temperature: {retry_error}")

    def _disconnect(self):
        """Clean up USB connection."""
        if self.device:
            try:
                usb.util.release_interface(self.device, self.interface)
                self.device.attach_kernel_driver(self.interface)
            except Exception as e:
                pass  # Ignore cleanup errors

    def __del__(self):
        """Destructor to clean up resources."""
        self._disconnect()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - clean up resources."""
        self._disconnect()


# Alternative implementation using the temper-python library if installed
class TemperatureSensorAlt:
    def __init__(self):
        """
        Alternative implementation using the temper-python library.
        Requires: sudo apt-get install python-usb python-setuptools
        and: git clone git://github.com/padelt/temper-python.git
        """
        try:
            from temper import TemperHandler

            self.handler = TemperHandler()
            self.devices = self.handler.get_devices()

            if not self.devices:
                raise ValueError("No TEMPer devices found")

        except ImportError:
            raise ImportError(
                "temper-python library not found. Please install it from GitHub: https://github.com/padelt/temper-python"
            )

    def read_temperature(self):
        """
        Read temperature using the temper-python library.

        Returns:
            float: Temperature in Celsius
        """
        try:
            readings = self.handler.get_temperatures(self.devices)
            if readings:
                return readings[0]  # Return first device's temperature
            else:
                raise Exception("No temperature reading available")
        except Exception as e:
            raise Exception(f"Failed to read temperature: {e}")


# Example usage and test function
if __name__ == "__main__":
    try:
        # Try the direct USB implementation first
        sensor = TemperatureSensor()
        temperature = sensor.read_temperature()
        print(f"Temperature: {temperature:.2f}°C")

    except Exception as e1:
        print(f"Direct USB method failed: {e1}")
        print("Trying alternative method with temper-python library...")

        try:
            # Fall back to the alternative implementation
            sensor = TemperatureSensorAlt()
            temperature = sensor.read_temperature()
            print(f"Temperature: {temperature:.2f}°C")

        except Exception as e2:
            print(f"Alternative method also failed: {e2}")
            print("Please make sure:")
            print("1. The TEMPer USB sensor is connected")
            print(
                "2. Required packages are installed: sudo apt-get install python-usb python-setuptools"
            )
            print("3. temper-python library is available")
