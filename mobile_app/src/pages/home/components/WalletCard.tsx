import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletService } from '../../../services/api';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';

export default function WalletCard() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('upi');
  const [isProcessing, setIsProcessing] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [bankName, setBankName] = useState('');

  // Fetch wallet balance and transactions
  useEffect(() => {
    const fetchWalletData = async () => {
      try {
        setLoading(true);
        const [balanceData, transactionsData] = await Promise.all([
          walletService.getBalance(),
          walletService.getTransactions(5, 0) // Get last 5 transactions
        ]);

        setBalance(balanceData.balance);
        setTransactions(transactionsData);
      } catch (error) {
        console.error('Error fetching wallet data:', error);
        setBalance(0);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWalletData();
  }, []);

  const handleAddMoney = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return;

    // Validate payment method details
    if (selectedPaymentMethod === 'upi' && !upiId) return;
    if (selectedPaymentMethod === 'card' && (!cardNumber || !cardExpiry || !cardCvv)) return;
    if (selectedPaymentMethod === 'netbanking' && !bankName) return;

    setIsProcessing(true);
    
    try {
      // Call API to add money
      const paymentDetails = selectedPaymentMethod === 'upi' 
        ? { upi_id: upiId }
        : selectedPaymentMethod === 'card'
        ? { card_number: cardNumber, expiry: cardExpiry }
        : { bank_name: bankName };

      await walletService.addMoney({
        amount: amountNum,
        payment_method: selectedPaymentMethod,
        payment_details: paymentDetails
      });

      // Refresh balance and transactions
      const [balanceData, transactionsData] = await Promise.all([
        walletService.getBalance(),
        walletService.getTransactions(5, 0)
      ]);

      setBalance(balanceData.balance);
      setTransactions(transactionsData);
      
      // Reset form
      setAmount('');
      setUpiId('');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      setBankName('');
      setShowAddMoneyModal(false);
    } catch (error) {
      console.error('Error adding money:', error);
      alert('Failed to add money. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickAmount = (quickAmount: number) => {
    setAmount(quickAmount.toString());
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'charging':
        return 'ri-flashlight-line';
      case 'add_money':
        return 'ri-add-circle-line';
      case 'refund':
        return 'ri-arrow-left-circle-line';
      default:
        return 'ri-money-rupee-circle-line';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'charging':
        return 'text-red-600';
      case 'add_money':
      case 'refund':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted;
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  return (
    <>
      <Card className="ev-wallet-card-home border-0">
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div>
            <p className="text-white/90 text-sm mb-1 font-medium">Wallet Balance</p>
            <h3 className="text-3xl font-bold text-white">₹{balance.toLocaleString()}</h3>
          </div>
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <i className="ri-wallet-3-line text-2xl"></i>
          </div>
        </div>
        
        <div className="flex space-x-2 relative z-10">
          <Button 
            variant="secondary" 
            size="sm" 
            className="flex-1 bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm font-semibold"
            onClick={() => setShowAddMoneyModal(true)}
          >
            <i className="ri-add-line mr-2"></i>
            Add Money
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            className="flex-1 bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm font-semibold"
            onClick={() => setShowHistoryModal(true)}
          >
            <i className="ri-history-line mr-2"></i>
            History
          </Button>
        </div>
      </Card>

      {/* Enhanced Add Money Modal */}
      {showAddMoneyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50 backdrop-blur-sm">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Add Money</h3>
                <p className="text-sm text-gray-500 mt-1">Choose amount and payment method</p>
              </div>
              <button 
                onClick={() => setShowAddMoneyModal(false)}
                className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <i className="ri-close-line text-xl text-gray-700"></i>
              </button>
            </div>
            
            <div className="space-y-5">
              {/* Amount Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Enter Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg font-semibold">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full pl-10 pr-4 py-4 border-2 border-gray-200 rounded-xl text-2xl font-bold text-gray-900 focus:outline-none transition-colors"
                    style={{borderColor: '#E6F9E6'}}
                    onFocus={(e) => e.target.style.borderColor = '#76B82A'}
                    onBlur={(e) => e.target.style.borderColor = '#E6F9E6'}
                  />
                </div>
              </div>
              
              {/* Quick Amount Buttons */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Quick Add</label>
                <div className="grid grid-cols-4 gap-2">
                  {[500, 1000, 2000, 5000].map((quickAmount) => (
                    <button
                      key={quickAmount}
                      onClick={() => handleQuickAmount(quickAmount)}
                      className={`p-3 border-2 rounded-xl text-sm font-semibold transition-all ${
                        amount === quickAmount.toString()
                          ? 'text-white border-transparent'
                          : 'bg-white text-gray-700'
                      }`}
                      style={{
                        background: amount === quickAmount.toString() ? 'linear-gradient(135deg, #76B82A, #52A01E)' : 'white',
                        borderColor: amount === quickAmount.toString() ? '#76B82A' : '#E6F9E6'
                      }}
                      onMouseEnter={(e) => {
                        if (amount !== quickAmount.toString()) {
                          e.currentTarget.style.borderColor = '#76B82A';
                          e.currentTarget.style.background = 'rgba(118, 184, 42, 0.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (amount !== quickAmount.toString()) {
                          e.currentTarget.style.borderColor = '#E6F9E6';
                          e.currentTarget.style.background = 'white';
                        }
                      }}
                    >
                      ₹{quickAmount}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Payment Method Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Payment Method</label>
                <div className="space-y-3">
                  {/* UPI Option */}
                  <div 
                    onClick={() => setSelectedPaymentMethod('upi')}
                    className="p-4 border-2 rounded-xl cursor-pointer transition-all"
                    style={{
                      borderColor: selectedPaymentMethod === 'upi' ? '#76B82A' : '#E6F9E6',
                      background: selectedPaymentMethod === 'upi' ? 'rgba(118, 184, 42, 0.05)' : 'white'
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                          <i className="ri-smartphone-line text-purple-600 text-lg"></i>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">UPI</p>
                          <p className="text-xs text-gray-500">Google Pay, PhonePe, Paytm</p>
                        </div>
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                        style={{
                          borderColor: selectedPaymentMethod === 'upi' ? '#76B82A' : '#dfe6e9',
                          background: selectedPaymentMethod === 'upi' ? '#76B82A' : 'transparent'
                        }}>
                        {selectedPaymentMethod === 'upi' && (
                          <i className="ri-check-line text-white text-xs"></i>
                        )}
                      </div>
                    </div>
                    {selectedPaymentMethod === 'upi' && (
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="Enter UPI ID (e.g., name@upi)"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                      />
                    )}
                  </div>

                  {/* Card Option */}
                  <div 
                    onClick={() => setSelectedPaymentMethod('card')}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedPaymentMethod === 'card'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                          <i className="ri-bank-card-line text-blue-600 text-lg"></i>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Debit/Credit Card</p>
                          <p className="text-xs text-gray-500">Visa, Mastercard, RuPay</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedPaymentMethod === 'card'
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300'
                      }`}>
                        {selectedPaymentMethod === 'card' && (
                          <i className="ri-check-line text-white text-xs"></i>
                        )}
                      </div>
                    </div>
                    {selectedPaymentMethod === 'card' && (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                          placeholder="Card Number"
                          maxLength={19}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                            placeholder="MM/YY"
                            maxLength={5}
                            className="px-4 py-3 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                          />
                          <input
                            type="text"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                            placeholder="CVV"
                            maxLength={3}
                            className="px-4 py-3 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Net Banking Option */}
                  <div 
                    onClick={() => setSelectedPaymentMethod('netbanking')}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedPaymentMethod === 'netbanking'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                          <i className="ri-bank-line text-green-600 text-lg"></i>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Net Banking</p>
                          <p className="text-xs text-gray-500">All major banks supported</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedPaymentMethod === 'netbanking'
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300'
                      }`}>
                        {selectedPaymentMethod === 'netbanking' && (
                          <i className="ri-check-line text-white text-xs"></i>
                        )}
                      </div>
                    </div>
                    {selectedPaymentMethod === 'netbanking' && (
                      <select
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="">Select Your Bank</option>
                        <option value="sbi">State Bank of India</option>
                        <option value="hdfc">HDFC Bank</option>
                        <option value="icici">ICICI Bank</option>
                        <option value="axis">Axis Bank</option>
                        <option value="kotak">Kotak Mahindra Bank</option>
                        <option value="pnb">Punjab National Bank</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Security Badge */}
              <div className="flex items-center justify-center space-x-2 py-3 bg-green-50 rounded-lg">
                <i className="ri-shield-check-fill text-green-600"></i>
                <p className="text-xs text-green-700 font-medium">Secured by 256-bit SSL encryption</p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 py-3"
                  onClick={() => setShowAddMoneyModal(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700"
                  onClick={handleAddMoney}
                  disabled={
                    !amount || 
                    parseFloat(amount) <= 0 || 
                    isProcessing ||
                    (selectedPaymentMethod === 'upi' && !upiId) ||
                    (selectedPaymentMethod === 'card' && (!cardNumber || !cardExpiry || !cardCvv)) ||
                    (selectedPaymentMethod === 'netbanking' && !bankName)
                  }
                >
                  {isProcessing ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2"></i>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="ri-check-line mr-2"></i>
                      Add ₹{amount || '0'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Transaction History</h3>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="p-2"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.amount > 0 ? 'bg-green-100' : 'bg-red-100'
                    } mr-3`}>
                      <i className={`${getTransactionIcon(transaction.type)} ${getTransactionColor(transaction.type)}`}></i>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{transaction.description}</p>
                      <p className="text-xs text-gray-500">{transaction.date} • {transaction.time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.amount > 0 ? '+' : ''}₹{Math.abs(transaction.amount)}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{transaction.status}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setShowHistoryModal(false);
                navigate('/wallet');
              }}
            >
              View All in Wallet
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
