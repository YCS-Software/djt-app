import { useState } from 'react';
import EVHeader from '../../components/EVHeader';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { Wallet as WalletIcon, Plus, Send, CreditCard, Smartphone, Building2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import './wallet.css';

const transactions = [
  {
    id: '1',
    type: 'charge',
    title: 'Charging Session',
    location: 'PowerHub Mall Road',
    amount: '-₹285',
    date: 'Today, 2:30 PM',
    status: 'completed'
  },
  {
    id: '2',
    type: 'topup',
    title: 'Wallet Top-up',
    location: 'UPI Payment',
    amount: '+₹1,000',
    date: 'Today, 10:15 AM',
    status: 'completed'
  },
  {
    id: '3',
    type: 'charge',
    title: 'Charging Session',
    location: 'EcoCharge Central',
    amount: '-₹221',
    date: 'Yesterday, 6:15 PM',
    status: 'completed'
  },
  {
    id: '4',
    type: 'refund',
    title: 'Session Refund',
    location: 'QuickCharge Express',
    amount: '+₹45',
    date: 'Dec 15, 3:20 PM',
    status: 'completed'
  }
];

const quickAmounts = [500, 1000, 2000, 5000];

export default function Wallet() {
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferContact, setTransferContact] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('upi');
  const [balance, setBalance] = useState(2450.00);

  const handleAddMoney = () => {
    if (addAmount && parseFloat(addAmount) > 0) {
      const amount = parseFloat(addAmount);
      setBalance(prev => prev + amount);
      setShowAddMoney(false);
      setAddAmount('');
      // Show success message
      alert(`Successfully added ₹${amount} to your wallet!`);
    }
  };

  const handleTransfer = () => {
    if (transferAmount && transferContact && parseFloat(transferAmount) > 0) {
      const amount = parseFloat(transferAmount);
      if (amount <= balance) {
        setBalance(prev => prev - amount);
        setShowTransfer(false);
        setTransferAmount('');
        setTransferContact('');
        // Show success message
        alert(`Successfully transferred ₹${amount} to ${transferContact}!`);
      } else {
        alert('Insufficient balance for this transfer!');
      }
    }
  };

  const selectQuickAmount = (amount: number) => {
    setAddAmount(amount.toString());
  };

  const user = JSON.parse(localStorage.getItem('user') || '{"name":"Guest"}');

  return (
    <div className="min-h-screen ev-wallet-page">
      <EVHeader 
        userName={user.name}
        batteryLevel={78}
        location="Wallet Dashboard"
        showBattery={false}
      />
      
      <div className="pt-32 pb-24 px-4 space-y-6">
        {/* Balance Card */}
        <Card className="ev-balance-card">
          <div className="text-center mb-6">
            <p className="text-blue-100 text-sm mb-2">Available Balance</p>
            <p className="text-4xl font-bold mb-4">₹{balance.toFixed(2)}</p>
            <div className="flex space-x-3">
              <Button 
                variant="secondary" 
                className="flex-1 bg-white/20 text-white border-0 hover:bg-white/30"
                onClick={() => setShowAddMoney(true)}
              >
                <i className="ri-add-line mr-2"></i>
                Add Money
              </Button>
              <Button 
                variant="secondary" 
                className="flex-1 bg-white/20 text-white border-0 hover:bg-white/30"
                onClick={() => setShowTransfer(true)}
              >
                <i className="ri-send-plane-line mr-2"></i>
                Transfer
              </Button>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="text-center p-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <i className="ri-smartphone-line text-green-600 text-xl"></i>
            </div>
            <p className="text-sm font-medium text-gray-900">UPI</p>
          </Card>
          <Card className="text-center p-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <i className="ri-bank-card-line text-blue-600 text-xl"></i>
            </div>
            <p className="text-sm font-medium text-gray-900">Card</p>
          </Card>
          <Card className="text-center p-3">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <i className="ri-bank-line text-purple-600 text-xl"></i>
            </div>
            <p className="text-sm font-medium text-gray-900">Bank</p>
          </Card>
        </div>

        {/* Transaction History */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                    transaction.type === 'charge' ? 'bg-red-100' :
                    transaction.type === 'topup' ? 'bg-green-100' : 'bg-blue-100'
                  }`}>
                    <i className={`${
                      transaction.type === 'charge' ? 'ri-flashlight-line text-red-600' :
                      transaction.type === 'topup' ? 'ri-add-line text-green-600' : 'ri-refund-line text-blue-600'
                    }`}></i>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{transaction.title}</p>
                    <p className="text-gray-500 text-xs">{transaction.location}</p>
                    <p className="text-gray-400 text-xs">{transaction.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold text-sm ${
                    transaction.amount.startsWith('-') ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {transaction.amount}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Add Money Modal */}
      {showAddMoney && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Money</h3>
              <button 
                onClick={() => setShowAddMoney(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                <i className="ri-close-line text-gray-600"></i>
              </button>
            </div>
            
            {/* Amount Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                <input
                  type="number"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="0"
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-2 gap-2 mb-6">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => selectQuickAmount(amount)}
                  className="py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  ₹{amount}
                </button>
              ))}
            </div>

            {/* Payment Methods */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Payment Method</label>
              <div className="space-y-2">
                {[
                  { id: 'upi', label: 'UPI', icon: 'ri-smartphone-line' },
                  { id: 'card', label: 'Debit/Credit Card', icon: 'ri-bank-card-line' },
                  { id: 'netbanking', label: 'Net Banking', icon: 'ri-bank-line' }
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPaymentMethod(method.id)}
                    className={`w-full flex items-center p-3 rounded-lg border ${
                      selectedPaymentMethod === method.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <i className={`${method.icon} text-lg mr-3 ${
                      selectedPaymentMethod === method.id ? 'text-blue-600' : 'text-gray-600'
                    }`}></i>
                    <span className={`font-medium ${
                      selectedPaymentMethod === method.id ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {method.label}
                    </span>
                    {selectedPaymentMethod === method.id && (
                      <i className="ri-check-line text-blue-600 ml-auto"></i>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleAddMoney}
              className="w-full"
              disabled={!addAmount || parseFloat(addAmount) <= 0}
            >
              Add ₹{addAmount || '0'}
            </Button>
          </Card>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Transfer Money</h3>
              <button 
                onClick={() => setShowTransfer(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                <i className="ri-close-line text-gray-600"></i>
              </button>
            </div>
            
            {/* Contact Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
              <input
                type="text"
                value={transferContact}
                onChange={(e) => setTransferContact(e.target.value)}
                placeholder="Phone number or UPI ID"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0"
                  max={balance}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Available balance: ₹{balance.toFixed(2)}</p>
            </div>

            {/* Quick Transfer Amounts */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[100, 500, 1000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setTransferAmount(amount.toString())}
                  className="py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  disabled={amount > balance}
                >
                  ₹{amount}
                </button>
              ))}
            </div>

            <Button 
              onClick={handleTransfer}
              className="w-full"
              disabled={!transferAmount || !transferContact || parseFloat(transferAmount) <= 0 || parseFloat(transferAmount) > balance}
            >
              Transfer ₹{transferAmount || '0'}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
