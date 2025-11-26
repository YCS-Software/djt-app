# DJT HAIKA Theme - Quick Reference Card 🎨

## 🎯 Most Common CSS Variables

### Colors
```css
var(--primary)              /* #2D5F3F - Main dark green */
var(--secondary)            /* #52A01E - Medium green */
var(--accent)               /* #8BC34A - Light green */
```

### Gradients
```css
var(--gradient-primary)     /* Dark to medium green */
var(--gradient-secondary)   /* Medium to light green */
```

### Shadows
```css
var(--shadow-sm)            /* Subtle shadow */
var(--shadow-md)            /* Normal shadow */
var(--shadow-lg)            /* Prominent shadow */
```

---

## 🔧 Ready-to-Use Classes

### Buttons
```html
<button class="btn-primary">Click Me</button>
<button class="btn-secondary">Secondary</button>
<button class="btn-outline">Outline</button>
```

### Cards
```html
<div class="card">
  Your content here
</div>
```

### Inputs
```html
<input class="input" type="text" placeholder="Enter text" />
```

### Badges
```html
<span class="badge badge-success">Active</span>
<span class="badge badge-primary">New</span>
<span class="badge badge-warning">Pending</span>
```

---

## 🎨 Quick Examples

### Styled Button
```css
.my-button {
  background: var(--gradient-primary);
  color: white;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
```

### Styled Card
```css
.my-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-md);
}
```

### Styled Input
```css
.my-input {
  border: 2px solid var(--input-border);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
}

.my-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(45, 95, 63, 0.1);
}
```

---

## ✅ Status

**Theme**: DJT HAIKA ✅  
**Applied to**: All pages globally  
**Location**: `src/styles/djt-haika-theme.css`  
**Imported in**: `src/index.css`

---

**Your app now has professional, consistent DJT HAIKA branding!** 🚀
