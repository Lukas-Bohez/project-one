// storage.js (or similar)
const STORAGE_IP = {
  IP: {
    IP: 'IP'
  }
};


const getClientIP = async () => {
    try {
        const response = await fetch('/api/v1/client-ip');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.ip_address;
    } catch (error) {
        return null;
    }
};


// admin.js
const getClientIpAddress = async () => {
    try {
        // Using a public IP detection service (choose one that fits your privacy requirements)
        const response = await fetch('https://api.ipify.org?format=json');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        const ipAddress = data.ip;
        
        // Store in session storage
        sessionStorage.setItem(STORAGE_IP.IP.IP, ipAddress);
        return ipAddress;
    } catch (error) {
        console.error("Error fetching client IP:", error);
        
        // Fallback method using WebRTC (might not work in all browsers)
        try {
            const fallbackIp = await getIpFromWebRTC();
            if (fallbackIp) {
                sessionStorage.setItem(STORAGE_IP.IP.IP, fallbackIp);
                return fallbackIp;
            }
        } catch (e) {
            console.error("WebRTC fallback failed:", e);
        }
        
        return null;
    }
};

// WebRTC fallback method (may reveal local IP if public IP can't be detected)
const getIpFromWebRTC = () => {
    return new Promise((resolve) => {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .catch(() => resolve(null));
            
        pc.onicecandidate = (ice) => {
            if (!ice || !ice.candidate || !ice.candidate.candidate) {
                resolve(null);
                return;
            }
            const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
            const ipMatch = ipRegex.exec(ice.candidate.candidate);
            if (ipMatch && ipMatch[1]) {
                resolve(ipMatch[1]);
            } else {
                resolve(null);
            }
        };
    });
};

// Rest of your existing handleIpStatus function remains the same
const handleIpStatus = async (ipAddress) => {
    if (!ipAddress) {
        console.warn("No IP address available to check status.");
        return;
    }

    try {
        const url = `/api/v1/ip-status`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ ip_address: ipAddress })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        console.log("IP Status Check Result:", result);

        if (result.is_banned) {
            console.warn(`IP Address ${ipAddress} is banned! Kicking user...`);
            window.location.href = `/banned`;
            return true;
        } else {
            console.log(`IP Address ${ipAddress} is not banned. Welcome!`);
            const storedIP = sessionStorage.getItem(STORAGE_IP.IP.IP);
            console.log('Stored IP:', storedIP);
            return false;
        }
    } catch (error) {
        console.error("Error handling IP status:", error);
        return false;
    }
};

// DOM Content Loaded event
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Content Loaded. Initiating IP check...");

    const clientIp = await getClientIpAddress();

    if (clientIp) {
        const isBanned = await handleIpStatus(clientIp);
        if (isBanned) {
            return;
        }
    } else {
        console.error("Could not determine client IP address. Proceeding with caution.");
    }
});