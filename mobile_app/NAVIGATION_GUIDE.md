# 🧭 Navigation Guide

Complete guide on how to navigate between components after login.

## 📋 Route Structure

After login, users can navigate to these pages:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Login | Login page (no navigation bar) |
| `/home` | Home | Dashboard/Home page |
| `/wallet` | Wallet | Wallet page |
| `/charging` | Charging | Charging page |
| `/profile` | Profile | User profile page |

## 🎯 Navigation Methods

### 1. **Bottom Navigation Bar** (Recommended for Mobile)

After login, users see a bottom navigation bar with icons:
- 🏠 Home → `/home`
- 💰 Wallet → `/wallet`
- ⚡ Charging → `/charging`
- 👤 Profile → `/profile`
- 🚪 Logout → Logs out and returns to `/`

**How it works:**
```tsx
// Automatically included in all protected routes via Layout component
<Layout>
  <Navigation />  {/* Bottom nav bar */}
  <Outlet />      {/* Your page content */}
</Layout>
```

### 2. **Programmatic Navigation** (useNavigate)

Use in component logic (e.g., after form submission):

```tsx
import { useNavigate } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();

  const handleSuccess = () => {
    // Navigate to home
    navigate('/home');
    
    // Navigate to wallet
    navigate('/wallet');
    
    // Navigate back
    navigate(-1);
    
    // Navigate with replace (no back button)
    navigate('/home', { replace: true });
    
    // Navigate with state
    navigate('/profile', { 
      state: { userId: '123' } 
    });
  };
}
```

**Example: After Login**
```tsx
// In Login.tsx
const verifyOTP = async () => {
  // ... verify OTP logic
  if (success) {
    localStorage.setItem('x-access-token', token);
    navigate('/home'); // ✅ Navigate to home
  }
};
```

### 3. **Link Component** (Clickable Links)

Use for clickable navigation:

```tsx
import { Link } from 'react-router-dom';

function MyComponent() {
  return (
    <div>
      <Link to="/home">Go to Home</Link>
      <Link to="/wallet">View Wallet</Link>
      <Link to="/profile">My Profile</Link>
    </div>
  );
}
```

**With Active State:**
```tsx
import { Link, useLocation } from 'react-router-dom';

function Navigation() {
  const location = useLocation();
  
  return (
    <Link 
      to="/home"
      className={location.pathname === '/home' ? 'active' : ''}
    >
      Home
    </Link>
  );
}
```

### 4. **NavLink Component** (Auto-active Links)

Better for navigation menus:

```tsx
import { NavLink } from 'react-router-dom';

function Navigation() {
  return (
    <NavLink 
      to="/home"
      className={({ isActive }) => isActive ? 'active' : ''}
    >
      Home
    </NavLink>
  );
}
```

### 5. **Navigate Component** (Declarative)

Use for redirects:

```tsx
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  const isAuthenticated = localStorage.getItem('x-access-token');
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}
```

## 🔐 Navigation After Login

### Current Flow:

1. **User enters mobile number** → Login page (`/`)
2. **Verifies OTP** → Login successful
3. **Navigate to home** → `navigate('/home')`
4. **Bottom nav appears** → Can navigate to all pages

### Login.tsx Example:

```tsx
const verifyOTP = async () => {
  try {
    const response = await fetch(`${API_URL}/auth/app/verify/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phno, otp, otpID, usr_id }),
    });

    const data = await response.json();

    if (data.status === 200) {
      // Save token
      localStorage.setItem('x-access-token', data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      
      setSuccess('Login successful!');
      
      // Navigate to home after 1 second
      setTimeout(() => {
        navigate('/home'); // ✅ This navigates to home page
      }, 1000);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

## 🗺️ Navigation Examples

### Example 1: Navigate from Home to Wallet
```tsx
// In Home component
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();
  
  return (
    <button onClick={() => navigate('/wallet')}>
      View Wallet
    </button>
  );
}
```

### Example 2: Navigate with User Data
```tsx
// In Profile component
const navigate = useNavigate();

const editProfile = () => {
  navigate('/profile/edit', {
    state: { 
      userId: user.usr_id,
      name: user.name 
    }
  });
};

// In Edit Profile component
import { useLocation } from 'react-router-dom';

function EditProfile() {
  const location = useLocation();
  const { userId, name } = location.state;
  
  return <div>Editing {name}</div>;
}
```

### Example 3: Conditional Navigation
```tsx
const handleAction = () => {
  const hasWallet = checkWalletExists();
  
  if (hasWallet) {
    navigate('/wallet');
  } else {
    navigate('/wallet/create');
  }
};
```

### Example 4: Protected Navigation
```tsx
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

function ProtectedPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const token = localStorage.getItem('x-access-token');
    
    if (!token) {
      // Redirect to login if not authenticated
      navigate('/', { replace: true });
    }
  }, [navigate]);
  
  return <div>Protected Content</div>;
}
```

## 📱 Bottom Navigation Usage

The bottom navigation automatically appears on all protected routes:

**Routes WITH Navigation:**
- `/home` ✅
- `/wallet` ✅
- `/charging` ✅
- `/profile` ✅

**Routes WITHOUT Navigation:**
- `/` (Login) ❌

**How it's configured:**
```tsx
// router/config.tsx
{
  element: <Layout />,  // Layout includes Navigation
  children: [
    { path: "/home", element: <Home /> },
    { path: "/wallet", element: <Wallet /> },
    // ... all protected routes
  ]
}
```

## 🎨 Customizing Navigation

### Change Active Color:
```css
/* Navigation.css */
.nav-item.active {
  color: #667eea;  /* Change this color */
}
```

### Add More Navigation Items:
```tsx
// Navigation.tsx
const navItems = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/wallet', icon: Wallet, label: 'Wallet' },
  { path: '/charging', icon: Zap, label: 'Charging' },
  { path: '/profile', icon: User, label: 'Profile' },
  { path: '/settings', icon: Settings, label: 'Settings' }, // Add new item
];
```

### Remove Navigation from Specific Page:
```tsx
// router/config.tsx - Move route outside Layout
{
  path: "/special-page",
  element: <SpecialPage />,  // No navigation
},
```

## 🔍 Check Current Route

```tsx
import { useLocation } from 'react-router-dom';

function MyComponent() {
  const location = useLocation();
  
  console.log('Current path:', location.pathname);
  console.log('Search params:', location.search);
  console.log('State:', location.state);
  
  if (location.pathname === '/home') {
    // Do something on home page
  }
}
```

## 🚀 Quick Reference

| Task | Code |
|------|------|
| Navigate to home | `navigate('/home')` |
| Navigate to wallet | `navigate('/wallet')` |
| Go back | `navigate(-1)` |
| Go forward | `navigate(1)` |
| Replace current page | `navigate('/home', { replace: true })` |
| Pass data | `navigate('/page', { state: { data } })` |
| Logout & redirect | `navigate('/')` |
| Get current path | `location.pathname` |
| Create link | `<Link to="/home">Home</Link>` |

## 📝 Complete Navigation Flow

```
1. User opens app → `/` (Login page)
   ├─ No bottom navigation
   └─ Shows login form

2. User enters mobile & OTP
   └─ Successful login

3. Navigate to home → `/home`
   ├─ Bottom navigation appears
   ├─ Can click icons to navigate
   └─ User is on Home page

4. User clicks Wallet icon
   └─ Navigate to → `/wallet`

5. User clicks Profile icon
   └─ Navigate to → `/profile`

6. User clicks Logout
   ├─ Clear localStorage
   └─ Navigate to → `/` (Login)
```

## ✅ Summary

**After Login Navigation:**
1. ✅ Use `navigate('/home')` to go to home page
2. ✅ Bottom navigation automatically shows
3. ✅ Click icons to navigate between pages
4. ✅ All routes (/home, /wallet, /charging, /profile) are accessible
5. ✅ Logout returns to login page

**Your app is now ready with full navigation!** 🎉
