# 🎯 EV Header Component Guide

Complete documentation for the EVHeader component that matches the login theme.

## 📋 Overview

The `EVHeader` component is a modern, animated header designed specifically for EV charging applications. It features:
- ⚡ **Green gradient background** matching login theme
- 🔋 **Battery level indicator** with dynamic colors
- 📍 **Location display** with pulsing icon
- 🔔 **Notification badge** with pop animation
- 👤 **User avatar** with greeting
- ✨ **Smooth animations** throughout

## 🎨 Design Features

### Visual Elements
1. **Gradient Background**: Lime green (#76B82A) to dark green (#52A01E)
2. **Pulsing Bottom Line**: Animated charging effect
3. **Glassmorphism**: Frosted glass effects on badges
4. **Icon Animations**: Subtle pulses and glows

### Layout Structure
```
┌─────────────────────────────────────┐
│  [Avatar] Name      [Battery] [🔔]  │  ← Top Row
│  📍 Location        ⚡ EV Charging   │  ← Bottom Row
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │  ← Pulse Line
└─────────────────────────────────────┘
```

## 🔧 Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `userName` | string | 'Guest' | User's name for display |
| `batteryLevel` | number | 75 | Battery percentage (0-100) |
| `location` | string | 'Current Location' | Display location text |
| `showBattery` | boolean | true | Show/hide battery indicator |

## 📝 Usage Examples

### Basic Usage
```tsx
import EVHeader from '../components/EVHeader';

function HomePage() {
  return (
    <div>
      <EVHeader />
      {/* Page content */}
    </div>
  );
}
```

### With User Data
```tsx
const user = JSON.parse(localStorage.getItem('user') || '{}');

<EVHeader 
  userName={user.name}
  batteryLevel={78}
  location="Sector 18, Gurugram"
  showBattery={true}
/>
```

### Profile Page (No Battery)
```tsx
<EVHeader 
  userName="Rajesh Kumar"
  location="Delhi NCR"
  showBattery={false}  // Hide battery on profile
/>
```

### Dynamic Battery Level
```tsx
const [battery, setBattery] = useState(85);

<EVHeader 
  userName="John Doe"
  batteryLevel={battery}
  location="Mumbai"
/>
```

## 🎨 Styling Features

### Battery Color Logic
```typescript
// Green: > 60%
// Orange: 20-60%
// Red: < 20%

const getBatteryColor = () => {
  if (batteryLevel > 60) return '#76B82A';
  if (batteryLevel > 20) return '#f39c12';
  return '#e74c3c';
};
```

### Greeting Logic
```typescript
// Morning: 00:00 - 11:59
// Afternoon: 12:00 - 17:59
// Evening: 18:00 - 23:59

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
};
```

## 🎬 Animations

### 1. Header Pulse (Bottom Line)
```css
animation: headerPulse 3s linear infinite;
```
- Horizontal line slides left to right
- Represents charging energy flow
- 3-second cycle

### 2. Battery Icon Pulse
```css
animation: batteryPulseHeader 2s infinite;
```
- Subtle scale and opacity change
- Draws attention to battery level
- 2-second cycle

### 3. Notification Badge Pop
```css
animation: badgePop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
```
- Bouncy entrance animation
- Appears when badge is shown
- Elastic easing

### 4. Location Pulse
```css
animation: locationPulse 2s infinite;
```
- MapPin icon fades in/out
- Indicates active location
- 2-second cycle

### 5. Zap Icon Pulse
```css
animation: zapPulse 1.5s infinite;
```
- Scale and rotate animation
- Brand identity animation
- 1.5-second cycle

## 📱 Responsive Design

### Desktop (> 480px)
- Full padding: 1rem 1.25rem
- Avatar size: 44px
- Font sizes: Regular

### Mobile (<= 480px)
- Reduced padding: 0.875rem 1rem
- Avatar size: 40px
- Smaller fonts
- Compact location text (max-width: 120px)

## 🎯 Integration Guide

### Step 1: Import Component
```tsx
import EVHeader from '../../components/EVHeader';
```

### Step 2: Replace Old Header
```tsx
// ❌ Old
<TopNavigation title="Page" />

// ✅ New
<EVHeader 
  userName={user.name}
  batteryLevel={78}
  location="Current Location"
/>
```

### Step 3: Adjust Page Padding
```tsx
// Add top padding for fixed header
<div className="pt-32 pb-24">
  {/* Content */}
</div>
```

## 🎨 Customization

### Change Header Height
```css
.ev-header {
  padding: 1.5rem 1.25rem; /* Increase for taller header */
}
```

### Modify Gradient Colors
```css
.ev-header {
  background: linear-gradient(135deg, 
    #YOUR_COLOR_1 0%, 
    #YOUR_COLOR_2 100%
  );
}
```

### Add More Actions
```tsx
// In EVHeader.tsx
<div className="ev-header-actions">
  {/* Existing actions */}
  <button className="ev-action-btn">
    <Settings size={20} />
  </button>
</div>
```

## 🔔 Notification System

### Current Implementation
```tsx
<button className="ev-notification-btn">
  <Bell size={20} />
  <span className="ev-notification-badge">3</span>
</button>
```

### Future Enhancement
```tsx
const [notifications, setNotifications] = useState(3);

<button onClick={() => navigate('/notifications')}>
  <Bell size={20} />
  {notifications > 0 && (
    <span className="ev-notification-badge">
      {notifications}
    </span>
  )}
</button>
```

## 🗺️ Location Features

### Static Location
```tsx
<EVHeader location="Sector 18, Gurugram" />
```

### Dynamic Location (Geolocation)
```tsx
const [location, setLocation] = useState('Detecting...');

useEffect(() => {
  navigator.geolocation.getCurrentPosition((position) => {
    // Reverse geocode to get address
    setLocation('Current Location');
  });
}, []);

<EVHeader location={location} />
```

## 🔋 Battery Level Integration

### Manual Update
```tsx
const [battery, setBattery] = useState(75);

// Update battery
setBattery(85);
```

### From API
```tsx
useEffect(() => {
  fetch('/api/vehicle/battery')
    .then(res => res.json())
    .then(data => setBattery(data.level));
}, []);
```

### Real-time Updates
```tsx
useEffect(() => {
  const interval = setInterval(() => {
    fetch('/api/vehicle/battery')
      .then(res => res.json())
      .then(data => setBattery(data.level));
  }, 30000); // Every 30 seconds

  return () => clearInterval(interval);
}, []);
```

## 🎨 Theme Matching

### With Login Page
Both use same:
- ✅ Green gradient (#76B82A → #52A01E)
- ✅ White text on green
- ✅ Rounded corners (16px+)
- ✅ Smooth animations
- ✅ Shadow with green tint

### With Navigation Bar
- ✅ Green accents
- ✅ Consistent icon style
- ✅ Same color palette
- ✅ Matching animations

## 🚀 Performance

### Optimizations
1. **Fixed Positioning**: No reflow on scroll
2. **CSS Animations**: Hardware accelerated
3. **Minimal Re-renders**: Memoized if needed
4. **Lazy Icons**: Only load what's visible

### Bundle Size
- Component: ~3KB
- CSS: ~4KB
- Icons (lucide): Shared across app

## ✅ Checklist

### For Each Page:
- [ ] Import `EVHeader`
- [ ] Pass user data
- [ ] Set appropriate `batteryLevel`
- [ ] Add correct `location`
- [ ] Toggle `showBattery` if needed
- [ ] Adjust page padding (pt-32)
- [ ] Remove old header component
- [ ] Test responsive layout
- [ ] Verify animations
- [ ] Check click handlers

## 📝 Notes

1. **Fixed Position**: Header stays at top while scrolling
2. **Z-Index**: Set to 100 to stay above content
3. **Avatar Click**: Navigates to profile page
4. **Battery Colors**: Auto-adjust based on level
5. **Greeting**: Auto-updates based on time of day

## 🎯 Best Practices

1. ✅ Always pass real user data from localStorage
2. ✅ Update battery level from vehicle API
3. ✅ Use geolocation for accurate location
4. ✅ Handle notification click events
5. ✅ Test on mobile devices
6. ✅ Ensure accessibility (ARIA labels)
7. ✅ Keep animations smooth (60fps)

## 🔄 Future Enhancements

- [ ] Add search functionality
- [ ] Implement notification panel
- [ ] Add user menu dropdown
- [ ] Support dark mode
- [ ] Add skeleton loading
- [ ] Implement swipe gestures
- [ ] Add haptic feedback

---

**Component Version**: 1.0  
**Theme**: EV Charging Station  
**Status**: ✅ Production Ready
