import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import { User, Mail, Phone, ArrowRight, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import djtLogo from '../assets/logos/djt_logo.png';
import './Signup.css';

const Signup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [otpID, setOtpID] = useState('');

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  // Validate form
  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Please enter your name');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Please enter your phone number');
      return false;
    }
    if (formData.phone.length !== 10) {
      setError('Phone number must be 10 digits');
      return false;
    }
    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Please enter a valid email');
      return false;
    }
    return true;
  };

  // Send OTP
  const sendOTP = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      const response = await authService.sendSignupOTP(formData.phone);
      
      if (response.status === 200) {
        setOtpID(response.data.otpID);
        setSuccess('OTP sent successfully!');
        setStep('otp');
      } else {
        setError(response.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  // Handle OTP backspace
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Register user
  const handleSignup = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 4) {
      setError('Please enter complete OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // First verify OTP
      const verifyResponse = await authService.verifyOTP({
        phno: formData.phone,
        otp: otpCode,
        otpID: otpID,
        usr_id: ''
      });
      
      if (verifyResponse.status === 200) {
        // Then register the user with additional details
        const registerResponse = await authService.register({
          phone: formData.phone,
          name: formData.name,
          email: formData.email || null
        });

        if (registerResponse.status === 200) {
          setSuccess('Account created successfully!');
          
          // Save token and redirect
          if (registerResponse.data.token) {
            localStorage.setItem('token', registerResponse.data.token);
            localStorage.setItem('user', JSON.stringify(registerResponse.data.user));
          }

          setTimeout(() => {
            navigate('/home');
          }, 1500);
        } else {
          setError(registerResponse.message || 'Registration failed');
        }
      } else {
        setError(verifyResponse.message || 'Invalid OTP');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      {/* Background */}
      <div className="signup-bg">
        <div className="bg-gradient-ev"></div>
      </div>

      {/* Signup Card */}
      <div className="signup-card">
        {/* Logo Section */}
        <div className="logo-section">
          <div className="logo-circle">
            <img src={djtLogo} alt="DJT HAIKA" className="logo-image" />
          </div>
          <h1 className="app-title">
            <span className="brand-text">DJT HAIKA</span>
          </h1>
          <p className="app-subtitle">Create Your Account</p>
        </div>

        {/* User Details Step */}
        {step === 'details' && (
          <div className="form-step animate-slide-in">
            <div className="step-header">
              <h2>Sign Up</h2>
              <p>Enter your details to get started</p>
            </div>

            {error && (
              <div className="message error-message">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <div className="input-wrapper">
                <div className="input-icon">
                  <User size={20} />
                </div>
                <input
                  id="name"
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleChange}
                  maxLength={100}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number *</label>
              <div className="input-wrapper">
                <div className="input-icon">
                  <Phone size={20} />
                </div>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  className="form-input"
                  placeholder="10-digit mobile number"
                  value={formData.phone}
                  onChange={handleChange}
                  maxLength={10}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email (Optional)</label>
              <div className="input-wrapper">
                <div className="input-icon">
                  <Mail size={20} />
                </div>
                <input
                  id="email"
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  maxLength={100}
                />
              </div>
            </div>

            <button
              className="submit-btn"
              onClick={sendOTP}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="spin" />
                  Sending OTP...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight size={20} />
                </>
              )}
            </button>

            <button
              className="back-btn"
              onClick={() => navigate('/login')}
            >
              <ArrowLeft size={18} />
              Back to Login
            </button>
          </div>
        )}

        {/* OTP Verification Step */}
        {step === 'otp' && (
          <div className="form-step animate-slide-in">
            <div className="step-header">
              <h2>Verify OTP</h2>
              <p>Enter the code sent to {formData.phone}</p>
            </div>

            {error && (
              <div className="message error-message">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            {success && (
              <div className="message success-message">
                <CheckCircle2 size={18} />
                {success}
              </div>
            )}

            <div className="otp-group">
              <div className="otp-inputs">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={`otp-input ${digit ? 'filled' : ''}`}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  />
                ))}
              </div>
            </div>

            <button
              className="submit-btn"
              onClick={handleSignup}
              disabled={loading || otp.join('').length !== 4}
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                  <CheckCircle2 size={20} />
                </>
              )}
            </button>

            <button
              className="back-btn"
              onClick={() => setStep('details')}
            >
              <ArrowLeft size={18} />
              Change Details
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Signup;
