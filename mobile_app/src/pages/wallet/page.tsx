import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Wallet as WalletIcon, 
  Plus, 
  X,
  Smartphone,
  CreditCard,
  Building2,
  Check,
  Zap,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { walletService, type Transaction } from '../../services/api/walletService';
import { paymentService } from '../../services/api/paymentService';
import './wallet.css';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const quickAmounts = [500, 1000, 2000, 5000];

export default function Wallet() {
  const navigate = useNavigate();
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('upi');
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('x-access-token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    // Fetch wallet data
    fetchWalletData();

    return () => {
      // Cleanup script if needed
    };
  }, [navigate]);

  const fetchWalletData = async () => {
    try {
      setIsLoadingData(true);
      const [balanceData, transactionsData] = await Promise.all([
        walletService.getBalance(),
        walletService.getTransactions(50, 0)
      ]);
      
      setBalance(balanceData.balance || 0);
      setTransactions(transactionsData || []);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      // Set dummy data on error
      setBalance(520.00);
      setTransactions([
        {
          trxn_id: 1001,
          type: 'debit',
          category: 'charging',
          amount: 285.00,
          balance_before: 805.00,
          balance_after: 520.00,
          description: 'Charging Session - PowerHub Mall Road',
          status: 'completed',
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          trxn_id: 1002,
          type: 'credit',
          category: 'topup',
          amount: 1000.00,
          balance_before: 805.00,
          balance_after: 1805.00,
          description: 'Wallet Top-up via UPI',
          payment_method: 'upi',
          status: 'completed',
          created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
        }
      ]);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleAddMoney = async () => {
    if (!addAmount || parseFloat(addAmount) <= 0) return;
    
    setIsLoading(true);
    
    try {
      const amount = parseFloat(addAmount);
      
      // Create payment order
      const orderData = await paymentService.createOrder({
        amount: amount,
        currency: 'INR',
        payment_method: selectedPaymentMethod
      });

      // Initialize Razorpay
      if (!window.Razorpay) {
        throw new Error('Razorpay SDK not loaded');
      }

      const options = {
        key: orderData.key_id,
        amount: Math.round(amount * 100), // Convert to paise
        currency: orderData.currency,
        name: 'DJT HAIKA EV Charging',
        description: 'Wallet Top-up',
        order_id: orderData.order_id,
        handler: async function(response: any) {
          try {
            // Verify payment
            await paymentService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            // Add money to wallet
            await walletService.addMoney({
              amount: amount,
              payment_method: selectedPaymentMethod,
              payment_details: {
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature
              }
            });

            // Refresh wallet data
            await fetchWalletData();
            
            setShowAddMoney(false);
            setAddAmount('');
            alert('Money added successfully!');
          } catch (error) {
            console.error('Payment verification error:', error);
            alert('Payment verification failed. Please contact support.');
          } finally {
            setIsLoading(false);
          }
        },
        prefill: {
          name: 'User',
          email: '',
          contact: ''
        },
        theme: {
          color: '#16A34A'
        },
        modal: {
          ondismiss: function() {
            setIsLoading(false);
          }
        }
      };

      // For mock payments (when Razorpay is not configured)
      if (orderData.mock) {
        // Simulate successful payment
        setTimeout(async () => {
          try {
            await walletService.addMoney({
              amount: amount,
              payment_method: selectedPaymentMethod,
              payment_details: {
                order_id: orderData.order_id,
                payment_id: `pay_mock_${Date.now()}`,
                mock: true
              }
            });

            await fetchWalletData();
            setShowAddMoney(false);
            setAddAmount('');
            alert('Money added successfully! (Mock payment)');
          } catch (error) {
            console.error('Error adding money:', error);
            alert('Failed to add money. Please try again.');
          } finally {
            setIsLoading(false);
          }
        }, 1500);
        return;
      }

      // Open Razorpay checkout
      const razorpay = new window.Razorpay(options);
      razorpay.open();
      
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Payment failed. Please try again.');
      setIsLoading(false);
    }
  };

  const selectQuickAmount = (amount: number) => {
    setAddAmount(amount.toString());
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'debit':
      case 'charging':
        return <Zap size={18} />;
      case 'credit':
      case 'topup':
        return <ArrowDownLeft size={18} />;
      case 'refund':
        return <ArrowUpRight size={18} />;
      default:
        return <Zap size={18} />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'debit':
      case 'charging':
        return { bg: 'var(--ev-error-soft)', color: 'var(--ev-error)' };
      case 'credit':
      case 'topup':
        return { bg: 'var(--ev-success-soft)', color: 'var(--ev-success)' };
      case 'refund':
        return { bg: 'var(--ev-info-soft)', color: 'var(--ev-info)' };
      default:
        return { bg: 'var(--ev-primary-soft)', color: 'var(--ev-primary)' };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    }
  };

  if (isLoadingData) {
    return (
      <div className="wallet-page">
        <div className="wallet-loading">
          <div className="loading-spinner"></div>
          <p>Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-page">
      {/* Header */}
      <header className="wallet-header">
        <div className="header-content">
          <h1 className="page-title">Wallet</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="wallet-content">
        {/* Balance Card */}
        <section className="balance-card">
          <div className="balance-icon-wrap">
            <WalletIcon size={28} />
          </div>
          <div className="balance-info">
            <span className="balance-label">Available Balance</span>
            <div className="balance-amount">
              <span className="currency">₹</span>
              <span className="amount">{balance.toFixed(2)}</span>
            </div>
          </div>
          <button className="add-money-main-btn" onClick={() => setShowAddMoney(true)}>
            <Plus size={20} />
            <span>Add Money</span>
          </button>
        </section>

        {/* Payment Methods */}
        <section className="payment-methods">
          <h2 className="section-title">Quick Add</h2>
          <div className="methods-grid">
            <button className="method-card" onClick={() => setShowAddMoney(true)}>
              <div className="method-icon" style={{ background: 'var(--ev-success-soft)' }}>
                <Smartphone size={22} style={{ color: 'var(--ev-success)' }} />
              </div>
              <span className="method-name">UPI</span>
            </button>
            <button className="method-card" onClick={() => setShowAddMoney(true)}>
              <div className="method-icon" style={{ background: 'var(--ev-info-soft)' }}>
                <CreditCard size={22} style={{ color: 'var(--ev-info)' }} />
              </div>
              <span className="method-name">Card</span>
            </button>
            <button className="method-card" onClick={() => setShowAddMoney(true)}>
              <div className="method-icon" style={{ background: 'var(--ev-warning-soft)' }}>
                <Building2 size={22} style={{ color: 'var(--ev-warning)' }} />
              </div>
              <span className="method-name">Bank</span>
            </button>
          </div>
        </section>

        {/* Transaction History */}
        <section className="transactions-section">
          <h2 className="section-title">Recent Transactions</h2>
          <div className="transactions-list">
            {transactions.length > 0 ? (
              transactions.map((transaction) => {
                const colors = getTransactionColor(transaction.type);
                const isDebit = transaction.type === 'debit' || transaction.type === 'charging';
                return (
                  <div key={transaction.trxn_id} className="transaction-item">
                    <div 
                      className="transaction-icon"
                      style={{ background: colors.bg, color: colors.color }}
                    >
                      {getTransactionIcon(transaction.type)}
                    </div>
                    <div className="transaction-details">
                      <span className="transaction-title">{transaction.description}</span>
                      <span className="transaction-location">
                        {transaction.payment_method ? `${transaction.payment_method.toUpperCase()}` : 'Wallet'}
                      </span>
                      <span className="transaction-date">{formatDate(transaction.created_at)}</span>
                    </div>
                    <span className={`transaction-amount ${isDebit ? 'debit' : 'credit'}`}>
                      {isDebit ? '-' : '+'}₹{Math.abs(transaction.amount).toFixed(0)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="empty-transactions">
                <WalletIcon size={48} />
                <p>No transactions yet</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Add Money Modal */}
      {showAddMoney && (
        <div className="modal-overlay" onClick={() => !isLoading && setShowAddMoney(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Money</h3>
              <button className="modal-close" onClick={() => !isLoading && setShowAddMoney(false)} disabled={isLoading}>
                <X size={20} />
              </button>
            </div>

            {/* Amount Input */}
            <div className="amount-input-wrap">
              <span className="amount-currency">₹</span>
              <input
                type="number"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                placeholder="0"
                className="amount-input"
                autoFocus
                disabled={isLoading}
                min="1"
              />
            </div>

            {/* Quick Amounts */}
            <div className="quick-amounts">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => !isLoading && selectQuickAmount(amount)}
                  className={`quick-amount-btn ${addAmount === amount.toString() ? 'selected' : ''}`}
                  disabled={isLoading}
                >
                  ₹{amount}
                </button>
              ))}
            </div>

            {/* Payment Methods */}
            <div className="modal-methods">
              <p className="modal-methods-title">Payment Method</p>
              <div className="modal-methods-list">
                {[
                  { id: 'upi', label: 'UPI', icon: Smartphone },
                  { id: 'card', label: 'Debit/Credit Card', icon: CreditCard },
                  { id: 'netbanking', label: 'Net Banking', icon: Building2 }
                ].map((method) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.id}
                      onClick={() => !isLoading && setSelectedPaymentMethod(method.id)}
                      className={`modal-method-btn ${selectedPaymentMethod === method.id ? 'selected' : ''}`}
                      disabled={isLoading}
                    >
                      <Icon size={20} />
                      <span>{method.label}</span>
                      {selectedPaymentMethod === method.id && (
                        <Check size={18} className="check-icon" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add Button */}
            <button 
              onClick={handleAddMoney}
              className="modal-add-btn"
              disabled={!addAmount || parseFloat(addAmount) <= 0 || isLoading}
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner-small"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Plus size={20} />
                  <span>Add ₹{addAmount || '0'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
