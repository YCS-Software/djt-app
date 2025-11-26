# 🚗⚡ EV Charging Station Theme Guide

Complete guide for the Electric Vehicle Charging Station theme inspired by Grevo.

## 🎨 Color Palette

### Primary Colors
```css
--ev-green-primary: #76B82A  /* Lime Green - Main brand color */
--ev-green-dark: #52A01E     /* Dark Green - Hover states */
--ev-green-light: #9FD24A    /* Light Green - Accents */
--ev-green-pale: #E6F9E6     /* Pale Green - Backgrounds */
```

### Secondary Colors
```css
--ev-gray-dark: #2D3436      /* Text & Headers */
--ev-gray-medium: #636e72    /* Subtitles */
--ev-gray-light: #dfe6e9     /* Borders */
```

### Status Colors
```css
--ev-success: #27ae60        /* Success states */
--ev-warning: #f39c12        /* Warnings */
--ev-error: #e74c3c          /* Errors */
--ev-info: #3498db           /* Info messages */
```

## 🎯 Design Principles

### 1. **Green is King**
- Primary actions use lime green gradient
- Hover states intensify the green
- Success states use green tones
- Icons and accents feature green

### 2. **Modern & Clean**
- Large rounded corners (16px-24px)
- Generous white space
- Subtle shadows with green tints
- Smooth animations

### 3. **EV Visual Language**
- Battery icons for status
- Charging/zap icons for actions
- Car icons for navigation
- Flowing animations (like electricity)

## 🚀 Components

### Login Page
**Features:**
- ⚡ Animated charging lines flowing down
- 🔋 Pulsing battery icon
- 🚗 Floating EV icons (zap, battery, car)
- 🎯 Rotating charging ring around logo
- 💚 Lime green gradient background
- ✨ All animations synchronized

**Key Elements:**
```tsx
<div className="login-container ev-theme">
  <div className="logo-circle ev-logo">
    <Zap /> {/* Main icon */}
    <div className="charging-ring" /> {/* Rotating ring */}
  </div>
  <h1 className="ev-title">
    <span className="ev-text">EV Charging</span>
    <span className="station-text">Station</span>
  </h1>
</div>
```

### Buttons
```tsx
/* Primary Button - Green Gradient */
<button className="submit-btn">
  Send OTP
</button>

/* Secondary Button - Outline */
<button className="resend-btn">
  Resend OTP
</button>
```

### Navigation Bar
- Green top border
- Active items highlighted in green
- Smooth green glow on hover
- Icons from lucide-react

## 🎬 Animations

### 1. **Charging Flow** (Login Background)
```css
/* Vertical lines flowing like electricity */
animation: chargingFlow 3s linear infinite;
```

### 2. **Logo Pulse** (Charging Icon)
```css
/* Pulsing green glow */
animation: logoChargePulse 2s ease-in-out infinite;
```

### 3. **Ring Rotate** (Around Logo)
```css
/* Spinning ring effect */
animation: ringRotate 2s linear infinite;
```

### 4. **Battery Pulse** (Icon Animation)
```css
/* Battery level indicator effect */
animation: batteryPulse 2s infinite;
```

### 5. **Float Animations** (Background Icons)
```css
/* Floating EV icons */
.pulse-animation   /* Pulsing */
.float-animation   /* Up/Down movement */
.slide-animation   /* Left/Right movement */
```

## 📱 Page Themes

### Home Page
```tsx
- Green header with charging stats
- White cards with green accents
- Battery level indicators
- Quick actions in green
```

### Wallet Page
```tsx
- Balance card with green gradient
- Transaction list with green icons
- Add funds button in green
```

### Charging Page
```tsx
- Active session card in green
- Charging progress with green bar
- Station map with green markers
```

### Profile Page
```tsx
- User avatar with green border
- Settings list with green highlights
- Logout button in red (safety color)
```

## 🔧 Usage Examples

### Apply Green Theme to Card
```tsx
<div className="ev-card">
  <h3 className="ev-heading">Title</h3>
  <p className="ev-text-green">Green text</p>
</div>
```

### Green Button
```tsx
<button className="ev-btn-primary">
  <Zap size={20} />
  Start Charging
</button>
```

### Green Badge
```tsx
<span className="ev-badge">
  <Battery size={16} />
  Active
</span>
```

### Green Gradient Background
```tsx
<div className="ev-gradient-primary">
  Content with green gradient
</div>
```

## 🎨 Icon Usage

### Recommended Icons (lucide-react)

**Charging & Energy:**
- `<Zap />` - Main logo, charging actions
- `<Battery />` - Battery status, power
- `<BatteryCharging />` - Active charging
- `<Plug />` - Connection, stations

**Navigation:**
- `<Home />` - Home page
- `<Wallet />` - Wallet/payments
- `<MapPin />` - Stations, locations
- `<User />` - Profile

**Actions:**
- `<ArrowRight />` - Next, continue
- `<Check />` - Success, complete
- `<X />` - Close, cancel
- `<RefreshCw />` - Resend, retry

## 🎯 Theme Application Checklist

### ✅ Login Page
- [x] Green gradient background
- [x] Charging animations
- [x] Floating EV icons
- [x] Pulsing logo with ring
- [x] Green buttons
- [x] EV-themed title

### ⏳ Other Pages (To Apply)
- [ ] Home page with green cards
- [ ] Wallet page with green balance
- [ ] Charging page with progress
- [ ] Profile page with green accents
- [ ] Navigation bar (green border ✅)

## 💡 Best Practices

### DO ✅
- Use green for primary actions
- Add subtle animations
- Use EV-related icons
- Maintain consistent spacing
- Apply green shadows/glows
- Keep text readable on green

### DON'T ❌
- Overuse green (causes fatigue)
- Use green for errors
- Mix too many green shades
- Forget hover/focus states
- Ignore accessibility
- Forget white space

## 🎨 Color Usage Guide

| Element | Color | Usage |
|---------|-------|-------|
| **Primary Buttons** | Green Gradient | CTAs, main actions |
| **Headers** | Dark Gray | Page titles |
| **Body Text** | Medium Gray | Regular content |
| **Success** | Green | Confirmations |
| **Error** | Red | Errors, warnings |
| **Active State** | Bright Green | Selected items |
| **Hover** | Light Green BG | Interactive elements |
| **Background** | White/Pale Green | Main content areas |

## 🚗 EV Terminology

Use these terms throughout the app:
- **Charging Station** (not "gas station")
- **Charge** (not "fuel")
- **Battery Level** (not "fuel level")
- **kWh** (energy unit)
- **Range** (distance remaining)
- **Port** (charging connection)
- **Session** (charging period)

## 📐 Spacing & Sizing

```css
/* Borders */
Small:  8px
Medium: 12px
Large:  16px
XL:     24px

/* Padding */
Tight:  0.5rem (8px)
Normal: 1rem (16px)
Loose:  1.5rem (24px)
Spacious: 2rem (32px)

/* Shadows */
Small:  0 2px 8px rgba(118, 184, 42, 0.15)
Medium: 0 8px 20px rgba(118, 184, 42, 0.25)
Large:  0 15px 40px rgba(118, 184, 42, 0.35)
```

## 🎬 Animation Timing

```css
Fast:   0.2s  /* Hover states */
Normal: 0.3s  /* Transitions */
Slow:   0.5s  /* Page changes */
Loop:   2-3s  /* Continuous animations */
```

## 🌟 Feature Animations

### Charging Progress
```tsx
<div className="charging-progress">
  <div className="progress-bar" style={{width: `${percent}%`}} />
</div>
```

### Battery Indicator
```tsx
<Battery 
  className="battery-icon" 
  style={{color: level > 20 ? '#76B82A' : '#e74c3c'}}
/>
```

### Success Checkmark
```tsx
<CheckCircle 
  className="success-icon animate-scale"
  color="#76B82A"
  size={48}
/>
```

## 📱 Mobile Optimizations

- Larger touch targets (min 44px)
- Bottom navigation with green border
- Simplified animations on mobile
- Reduced shadows for performance
- Optimized icon sizes

## 🎯 Accessibility

- Green/red contrast checked
- Focus visible styles in green
- Keyboard navigation support
- Screen reader friendly labels
- Color-blind safe palette

## 🚀 Implementation Status

### ✅ Completed
- Login page with full EV theme
- Global EV CSS variables
- Navigation bar styling
- Button components
- Animation keyframes

### 🔄 In Progress
- Home page redesign
- Wallet page styling
- Charging page UI
- Profile page theme

### 📋 Todo
- Dashboard statistics
- Charging history cards
- Payment integration UI
- Settings page

## 📚 Resources

- **Design inspiration**: Grevo WordPress Theme
- **Icons**: lucide-react
- **Colors**: Green energy palette
- **Fonts**: System fonts (good performance)

---

**Theme Version**: 1.0  
**Last Updated**: November 2025  
**Status**: ✅ Login Complete, 🔄 App-wide Implementation
