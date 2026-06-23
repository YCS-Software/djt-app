import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import { Phone, ArrowRight, Loader2, CheckCircle2, AlertCircle, Battery, Car } from 'lucide-react';
import djtLogo from '../assets/logos/djt_logo.png';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [otpID, setOtpID] = useState('');
  const [userId, setUserId] = useState('');
  const [timer, setTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);
  
  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Timer countdown
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sendOTP = async () => {
    if (mobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await authService.sendOTP(mobile);

      if (response.status === 200) {
        setOtpID(response.data.otpID);
        setUserId(response.data.usr_id);
        setStep('otp');
        setSuccess('OTP sent successfully!');
        setTimer(60);
        setCanResend(false);

        // Show OTP in development mode
        if (response.data.dev_otp) {
          console.log('Development OTP:', response.data.dev_otp);
        }
      } else {
        setError(response.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      setError(err.message || 'Network error. Please try again.');
      console.error('Send OTP error:', err);
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    const otpValue = otp.join('');
    
    if (otpValue.length !== 4) {
      setError('Please enter complete OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authService.verifyOTP({
        phno: mobile,
        otp: otpValue,
        otpID: otpID,
        usr_id: userId,
      });

      if (response.status === 200) {
        setSuccess('Login successful!');
        localStorage.setItem('x-access-token', response.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));

        const dest = (response.data.user as any)?.userType === 'owner' ? '/owner' : '/home';
        setTimeout(() => {
          navigate(dest, { replace: true });
        }, 500);
      } else {
        setError(response.message || 'Invalid OTP');
        setOtp(['', '', '', '']);
        otpRefs[0].current?.focus();
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
      console.error('Verify OTP error:', err);
      setOtp(['', '', '', '']);
      otpRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    const newOtp = [...otp];
    
    for (let i = 0; i < 4; i++) {
      newOtp[i] = pastedData[i] || '';
    }
    
    setOtp(newOtp);
    const lastIndex = pastedData.length < 4 ? pastedData.length : 3;
    otpRefs[lastIndex].current?.focus();
  };

  const changeMobileNumber = () => {
    setStep('mobile');
    setOtp(['', '', '', '']);
    setError('');
    setSuccess('');
    setTimer(0);
    setCanResend(false);
  };

  const resendOTP = () => {
    if (!canResend) return;
    setOtp(['', '', '', '']);
    setError('');
    setSuccess('');
    sendOTP();
  };

  return (
    <div className="login-container ev-theme">
      {/* Animated Background */}
      <div className="login-bg">
        <div className="bg-gradient-ev"></div>
        <div className="floating-icons">
          <Battery className="icon icon-1 pulse-animation" />
          <Battery className="icon icon-2 float-animation" />
          <Car className="icon icon-3 slide-animation" />
        </div>
        <div className="charging-lines">
          <div className="line line-1"></div>
          <div className="line line-2"></div>
          <div className="line line-3"></div>
        </div>
      </div>

      {/* Login Card */}
      <div className="login-card ev-card">
        <div className="logo-section">
          <div className="logo-circle ev-logo">
            <img src={djtLogo} alt="DJT HAIKA" className="logo-image" />
            <div className="charging-ring"></div>
          </div>
          <h1 className="app-title ev-title">
            <span className="ev-text">DJT</span>
            <span className="station-text">EV</span>
            <span className="ev-text">POWERTECH</span>
          </h1>
          <p className="app-subtitle ev-subtitle">
            <Battery size={16} className="inline-icon" />
            EV Charging Station
          </p>
        </div>

        {/* Mobile Number Step */}
        {step === 'mobile' && (
          <div className="form-step animate-slide-in">
            <div className="step-header">
              <h2>Enter Mobile Number</h2>
              <p>We'll send you a verification code</p>
            </div>

            <div className="input-group">
              <div className="input-wrapper">
                <div className="input-icon">
                  <Phone size={20} />
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="Mobile Number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && sendOTP()}
                  className="mobile-input"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="message error-message animate-shake">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="message success-message animate-slide-in">
                <CheckCircle2 size={16} />
                <span>{success}</span>
              </div>
            )}

            <button
              onClick={sendOTP}
              disabled={loading || mobile.length !== 10}
              className="submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="spin" size={20} />
                  <span>Sending OTP...</span>
                </>
              ) : (
                <>
                  <span>Send OTP</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>

            {/* <div className="info-text">
              <p>🔐 Test Numbers: 9666476298, 8500382863</p>
            </div> */}

            <div className="signup-section">
              <p>Don't have an account?</p>
              <button
                onClick={() => navigate('/signup')}
                className="signup-btn"
              >
                Create Account
              </button>
            </div>
          </div>
        )}

        {/* OTP Verification Step */}
        {step === 'otp' && (
          <div className="form-step animate-slide-in">
            <div className="step-header">
              <h2>Verify OTP</h2>
              <p>Enter the code sent to {mobile}</p>
              <button onClick={changeMobileNumber} className="change-number-btn">
                Change Number
              </button>
            </div>

            <div className="otp-group">
              <div className="otp-inputs">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={otpRefs[index]}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={index === 0 ? handleOtpPaste : undefined}
                    className={`otp-input ${digit ? 'filled' : ''}`}
                    disabled={loading}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="message error-message animate-shake">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="message success-message animate-slide-in">
                <CheckCircle2 size={16} />
                <span>{success}</span>
              </div>
            )}

            <button
              onClick={verifyOTP}
              disabled={loading || otp.join('').length !== 4}
              className="submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="spin" size={20} />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Verify & Login</span>
                  <CheckCircle2 size={20} />
                </>
              )}
            </button>

            {/* Resend OTP */}
            <div className="resend-section">
              {!canResend && timer > 0 ? (
                <div className="timer-display">
                  <span>Resend OTP in {formatTimer(timer)}</span>
                </div>
              ) : (
                <button onClick={resendOTP} className="resend-btn" disabled={!canResend}>
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
