#!/usr/bin/env python3
import time

class HardcoreRFID:
    # RC_522 Command words
    PCD_IDLE = 0x00
    PCD_AUTHENT = 0x0E
    PCD_RECEIVE = 0x08
    PCD_TRANSMIT = 0x04
    PCD_TRANSCEIVE = 0x0C
    PCD_RESETPHASE = 0x0F
    PCD_CALCCRC = 0x03
 
    # Mifare_One card command words
    PICC_REQIDL = 0x26
    PICC_REQALL = 0x52
    PICC_ANTICOLL = 0x93
    PICC_SElECTTAG = 0x93
    PICC_AUTHENT1A = 0x60
    PICC_AUTHENT1B = 0x61
    PICC_READ = 0x30
    PICC_WRITE = 0xA0
    PICC_DECREMENT = 0xC0
    PICC_INCREMENT = 0xC1
    PICC_RESTORE = 0xC2
    PICC_TRANSFER = 0xB0
    PICC_HALT = 0x50
 
    # RC_522 Registers
    CommandReg = 0x01
    CommIEnReg = 0x02
    DivIEnReg = 0x03
    CommIrqReg = 0x04
    DivIrqReg = 0x05
    ErrorReg = 0x06
    Status1Reg = 0x07
    Status2Reg = 0x08
    FIFODataReg = 0x09
    FIFOLevelReg = 0x0A
    ControlReg = 0x0C
    BitFramingReg = 0x0D
    ModeReg = 0x11
    TxControlReg = 0x14
    TxAutoReg = 0x15
    TModeReg = 0x2A
    TPrescalerReg = 0x2B
    TReloadRegH = 0x2C
    TReloadRegL = 0x2D
 
    MAX_LEN = 16
 
    def __init__(self, dev='/dev/spidev0.0', spd=1000000):
        self.spi = None
        # No hardware initialization for Windows compatibility    def RC_522_Reset(self):
        try:
            self.Write_RC_522(self.CommandReg, self.PCD_RESETPHASE)
        except:
            pass
 
    def Write_RC_522(self, addr, val):
        try:
            if self.spi:
                self.spi.xfer2([(addr << 1) & 0x7E, val])
        except:
            pass
 
    def Read_RC_522(self, addr):
        try:
            if self.spi:
                val = self.spi.xfer2([((addr << 1) & 0x7E) | 0x80, 0])
                return val[1]
            return 0
        except:
            return 0
 
    def SetBitMask(self, reg, mask):
        try:
            tmp = self.Read_RC_522(reg)
            self.Write_RC_522(reg, tmp | mask)
        except:
            pass
 
    def ClearBitMask(self, reg, mask):
        try:
            tmp = self.Read_RC_522(reg)
            self.Write_RC_522(reg, tmp & (~mask))
        except:
            pass
 
    def AntennaOn(self):
        try:
            if not (self.Read_RC_522(self.TxControlReg) & 0x03):
                self.SetBitMask(self.TxControlReg, 0x03)
        except:
            pass
 
    def AntennaOff(self):
        try:
            self.ClearBitMask(self.TxControlReg, 0x03)
        except:
            pass
 
    def ToCard(self, command, sendData):
        backData = []
        backLen = 0
        status = None
        irqEn = 0x00
        waitIRq = 0x00
        
        try:
            if command == self.PCD_AUTHENT:
                irqEn = 0x12
                waitIRq = 0x10
            elif command == self.PCD_TRANSCEIVE:
                irqEn = 0x77
                waitIRq = 0x30
 
            self.Write_RC_522(self.CommIEnReg, irqEn | 0x80)
            self.ClearBitMask(self.CommIrqReg, 0x80)
            self.SetBitMask(self.FIFOLevelReg, 0x80)
 
            self.Write_RC_522(self.CommandReg, self.PCD_IDLE)
 
            for c in sendData:
                self.Write_RC_522(self.FIFODataReg, c)
 
            self.Write_RC_522(self.CommandReg, command)
            if command == self.PCD_TRANSCEIVE:
                self.SetBitMask(self.BitFramingReg, 0x80)
 
            i = 2000
            while True:
                n = self.Read_RC_522(self.CommIrqReg)
                if n & waitIRq:
                    break
                if n & 0x01 or i == 0:
                    break
                i -= 1
 
            self.ClearBitMask(self.BitFramingReg, 0x80)
 
            if i != 0:
                if (self.Read_RC_522(self.ErrorReg) & 0x1B) == 0x00:
                    status = "MI_OK"
 
                    if n & irqEn & 0x01:
                        status = "NOTAGERR"
 
                    if command == self.PCD_TRANSCEIVE:
                        n = self.Read_RC_522(self.FIFOLevelReg)
                        lastBits = self.Read_RC_522(self.ControlReg) & 0x07
                        backLen = (n - 1) * 8 + lastBits if lastBits != 0 else n * 8
 
                        for _ in range(n):
                            backData.append(self.Read_RC_522(self.FIFODataReg))
                else:
                    status = "ERR"
        except:
            status = "ERR"
            
        return status, backData, backLen
 
    def RC_522_Request(self, reqMode):
        try:
            self.Write_RC_522(self.BitFramingReg, 0x07)
            status, backData, backBits = self.ToCard(self.PCD_TRANSCEIVE, [reqMode])
            if status != "MI_OK" or backBits != 0x10:
                status = "ERR"
            return status, backBits
        except:
            return "ERR", 0
 
    def RC_522_Anticoll(self):
        serNum = []
        try:
            self.Write_RC_522(self.BitFramingReg, 0x00)
            serNumCheck = 0
            serNum.append(self.PICC_ANTICOLL)
            serNum.append(0x20)
            status, backData, _ = self.ToCard(self.PCD_TRANSCEIVE, serNum)
            if (status == "MI_OK") and (len(backData) == 5):
                for i in range(4):
                    serNumCheck ^= backData[i]
                if serNumCheck != backData[4]:
                    status = "ERR"
            return status, backData
        except:
            return "ERR", []
 
    def RC_522_SelectTag(self, serNum):
        try:
            buf = [self.PICC_SElECTTAG, 0x70] + serNum[:5]
            pOut = self.CalulateCRC(buf)
            buf += pOut
            status, backData, backLen = self.ToCard(self.PCD_TRANSCEIVE, buf)
            if status == "MI_OK" and backLen == 0x18:
                return 1
            return 0
        except:
            return 0
 
    def RC_522_Auth(self, authMode, BlockAddr, Sectorkey, serNum):
        try:
            buff = [authMode, BlockAddr] + Sectorkey[:6] + serNum[:4]
            status, _, _ = self.ToCard(self.PCD_AUTHENT, buff)
            return status
        except:
            return "ERR"
 
    def RC_522_Read(self, blockAddr):
        try:
            recvData = [self.PICC_READ, blockAddr]
            crc = self.CalulateCRC(recvData)
            recvData += crc
            status, backData, _ = self.ToCard(self.PCD_TRANSCEIVE, recvData)
            return backData
        except:
            return []
 
    def CalulateCRC(self, pIndata):
        try:
            self.ClearBitMask(self.DivIrqReg, 0x04)
            self.SetBitMask(self.FIFOLevelReg, 0x80)
            for c in pIndata:
                self.Write_RC_522(self.FIFODataReg, c)
            self.Write_RC_522(self.CommandReg, self.PCD_CALCCRC)
 
            i = 0xFF
            while i > 0:
                n = self.Read_RC_522(self.DivIrqReg)
                if n & 0x04:
                    break
                i -= 1
            retData = [
                self.Read_RC_522(0x22),
                self.Read_RC_522(0x21)
            ]
            return retData
        except:
            return [0, 0]
    
    def uid_to_number(self, uid):
        """Convert UID list to a single decimal number"""
        try:
            if not uid or len(uid) < 4:
                return None
            
            # Take only the first 4 bytes for the UID (ignore checksum)
            uid_bytes = uid[:4]
            
            # Convert to decimal number by treating as big-endian
            number = 0
            for byte in uid_bytes:
                number = (number << 8) + byte
            
            return number
        except:
            return None
    
    def read_card(self):
        """
        Main method to read RFID card and return numeric UID
        Returns None if no card detected or error occurred
        """
        try:
            # Check if a card is present
            status, _ = self.RC_522_Request(self.PICC_REQIDL)
            if status == "MI_OK":
                # Try to read the UID
                status, uid = self.RC_522_Anticoll()
                if status == "MI_OK":
                    # Convert UID to number and return it
                    uid_number = self.uid_to_number(uid)
                    return uid_number
            return None
        except:
            return None
 
    def cleanup(self):
        # No hardware to clean up
        pass

# Example usage with numeric UID output using the new read_card method
if __name__ == "__main__":
    reader = HardcoreRFID()
    print("Plaats een kaart tegen de lezer (druk Ctrl+C om te stoppen).")
        
    try:
        while True:
            # Use the new read_card method
            uid_number = reader.read_card()
            if uid_number:
                print(f"Kaart gedetecteerd - UID: {uid_number}")
                time.sleep(1)  # korte pauze om herhaald lezen te vermijden
            time.sleep(0.1)
     
    except KeyboardInterrupt:
        print("\nProgramma beëindigd door gebruiker.")
    finally:
        reader.cleanup()
        print("GPIO en SPI zijn afgesloten.")