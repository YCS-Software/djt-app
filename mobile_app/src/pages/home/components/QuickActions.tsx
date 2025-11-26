
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../components/base/Card';

const quickActions = [
  {
    id: 'scan',
    icon: 'ri-qr-scan-line',
    title: 'Scan QR',
    subtitle: 'Start charging',
    color: '#76B82A'
  },
  {
    id: 'find',
    icon: 'ri-map-pin-line',
    title: 'Find Station',
    subtitle: 'Near you',
    color: '#52A01E'
  },
  {
    id: 'book',
    icon: 'ri-calendar-line',
    title: 'Book Slot',
    subtitle: 'Reserve now',
    color: '#9FD24A'
  },
  {
    id: 'support',
    icon: 'ri-customer-service-line',
    title: 'Support',
    subtitle: '24/7 help',
    color: '#636e72'
  }
];

export default function QuickActions() {
  const navigate = useNavigate();
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const handleActionClick = (actionId: string) => {
    switch (actionId) {
      case 'scan':
        setShowQRScanner(true);
        break;
      case 'find':
        navigate('/charging');
        break;
      case 'book':
        navigate('/charging');
        break;
      case 'support':
        // Support functionality
        break;
      default:
        break;
    }
  };

  const handleQRScan = () => {
    setIsScanning(true);
    // Simulate QR scanning
    setTimeout(() => {
      setIsScanning(false);
      setShowQRScanner(false);
      // Navigate to charging page with station data
      navigate('/charging', { 
        state: { 
          scannedStation: {
            id: 'DJT001',
            name: 'DJT HAIKA Station Alpha',
            address: 'Tech Park, Sector 18, Gurugram',
            power: '150kW',
            connectorType: 'CCS2',
            pricePerUnit: '₹10/kWh'
          }
        }
      });
    }, 2000);
  };

  return (
    <>
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action.id)}
              className="flex items-center p-3 rounded-xl transition-all hover:shadow-md"
              style={{ 
                background: 'white',
                border: '2px solid #E6F9E6'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = action.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '#E6F9E6';
              }}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center mr-3"
                style={{ 
                  background: `${action.color}15`,
                  border: `2px solid ${action.color}30`
                }}
              >
                <i className={`${action.icon} text-lg`} style={{ color: action.color }}></i>
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900 text-sm">{action.title}</p>
                <p className="text-gray-500 text-xs">{action.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-qr-scan-line text-green-600 text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Scan QR Code</h3>
              <p className="text-gray-600 text-sm mb-6">
                Position the QR code within the frame to start charging
              </p>
              
              {/* QR Scanner Frame */}
              <div className="relative w-48 h-48 mx-auto mb-6 bg-gray-100 rounded-2xl flex items-center justify-center">
                {isScanning ? (
                  <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Scanning...</p>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 w-40 h-40 rounded-xl flex items-center justify-center">
                    <div className="text-center">
                      <i className="ri-qr-code-line text-4xl text-gray-400 mb-2"></i>
                      <p className="text-xs text-gray-500">Align QR code here</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowQRScanner(false)}
                  className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQRScan}
                  disabled={isScanning}
                  className="flex-1 py-3 px-4 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {isScanning ? 'Scanning...' : 'Start Scan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
