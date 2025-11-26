
import { useState } from 'react';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';

export default function QRScanner() {
  const [isScanning, setIsScanning] = useState(false);

  const handleScanClick = () => {
    setIsScanning(true);
    // Simulate scanning process
    setTimeout(() => {
      setIsScanning(false);
      alert('QR Code scanned successfully! Connecting to charging station...');
    }, 2000);
  };

  return (
    <Card className="ev-qr-card text-center">
      <div className="ev-qr-icon">
        <i className={`ri-qr-scan-line text-3xl ${isScanning ? 'animate-pulse' : ''}`}></i>
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Quick Start Charging</h3>
      <p className="text-gray-600 text-sm mb-4 font-medium">Scan QR code to start charging instantly</p>
      <Button 
        onClick={handleScanClick}
        disabled={isScanning}
        className="w-full"
      >
        {isScanning ? (
          <>
            <i className="ri-loader-4-line animate-spin mr-2"></i>
            Scanning...
          </>
        ) : (
          <>
            <i className="ri-qr-scan-line mr-2"></i>
            Scan QR Code
          </>
        )}
      </Button>
    </Card>
  );
}
