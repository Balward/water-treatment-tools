# Water Treatment Tools - Global Styles Implementation Guide

This guide explains how to use the new global CSS system to unify your UI across all water treatment applications.

## 🎯 Quick Start

### 1. Include the Global Styles

Add this line to your HTML `<head>` section:

```html
<link rel="stylesheet" href="../../global-styles.css">
```

**Path adjustments by location:**
- Apps in `packages/` folder: `../../global-styles.css`
- Apps in subdirectories: adjust path accordingly

### 2. Basic HTML Structure

Replace your existing structure with this standardized layout:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your App Name</title>
    <link rel="stylesheet" href="../../global-styles.css">
</head>
<body>
    <div class="wt-container">
        <!-- Header -->
        <header class="wt-header">
            <div class="wt-header-content">
                <div class="wt-brand">
                    <img src="../../city-logos/logo-square.png" alt="Logo" class="wt-logo">
                    <div class="wt-brand-text">
                        <h1>Your App Name</h1>
                        <p class="wt-tagline">Your app description</p>
                    </div>
                </div>
                <nav class="wt-nav">
                    <a href="../dashboard/dashboard.html" class="wt-nav-link">
                        🏠 Dashboard
                    </a>
                </nav>
            </div>
        </header>

        <!-- Main Content -->
        <main>
            <div class="wt-card">
                <!-- Your app content here -->
            </div>
        </main>
    </div>
</body>
</html>
```

## 🎨 Design System Overview

### Color Palette
```css
/* Primary Colors */
--primary-teal: #00677f
--primary-teal-light: #4a90a4
--secondary-blue: #1e3a5f
--accent-gold: #f2a900

/* Status Colors */
--success-green: #4caf50
--warning-amber: #ff9800
--error-red: #f44336
--info-blue: #2196f3
```

### Typography Scale
```css
--font-size-xs: 0.75rem    /* 12px */
--font-size-sm: 0.875rem   /* 14px */
--font-size-base: 1rem     /* 16px */
--font-size-lg: 1.125rem   /* 18px */
--font-size-xl: 1.25rem    /* 20px */
--font-size-2xl: 1.5rem    /* 24px */
--font-size-3xl: 1.875rem  /* 30px */
--font-size-4xl: 2.25rem   /* 36px */
```

### Spacing Scale
```css
--space-1: 0.25rem  /* 4px */
--space-2: 0.5rem   /* 8px */
--space-3: 0.75rem  /* 12px */
--space-4: 1rem     /* 16px */
--space-5: 1.25rem  /* 20px */
--space-6: 1.5rem   /* 24px */
--space-8: 2rem     /* 32px */
```

## 🧱 Component Library

### Cards

```html
<!-- Basic Card -->
<div class="wt-card">
    <h3>Card Title</h3>
    <p>Card content goes here...</p>
</div>

<!-- Compact Card -->
<div class="wt-card wt-card-compact">
    <p>Less padding for tighter layouts</p>
</div>

<!-- Spacious Card -->
<div class="wt-card wt-card-spacious">
    <h2>More padding for important content</h2>
</div>
```

### Buttons

```html
<!-- Primary Button -->
<button class="wt-btn wt-btn-primary">Primary Action</button>

<!-- Secondary Button -->
<button class="wt-btn wt-btn-secondary">Secondary Action</button>

<!-- Accent Button -->
<button class="wt-btn wt-btn-accent">Special Action</button>

<!-- Outline Button -->
<button class="wt-btn wt-btn-outline">Outline Style</button>

<!-- Different Sizes -->
<button class="wt-btn wt-btn-primary wt-btn-sm">Small</button>
<button class="wt-btn wt-btn-primary">Normal</button>
<button class="wt-btn wt-btn-primary wt-btn-lg">Large</button>
<button class="wt-btn wt-btn-primary wt-btn-xl">Extra Large</button>

<!-- With Icons -->
<button class="wt-btn wt-btn-primary">
    🔍 Search
</button>
```

### Forms

```html
<div class="wt-form-group">
    <label class="wt-label" for="example">Input Label</label>
    <input type="text" id="example" class="wt-input" placeholder="Enter text...">
</div>

<div class="wt-form-group">
    <label class="wt-label" for="select">Select Option</label>
    <select id="select" class="wt-select">
        <option>Option 1</option>
        <option>Option 2</option>
    </select>
</div>
```

### Grids

```html
<!-- Auto-fit grid (responsive) -->
<div class="wt-grid wt-grid-auto gap-6">
    <div class="wt-card">Item 1</div>
    <div class="wt-card">Item 2</div>
    <div class="wt-card">Item 3</div>
</div>

<!-- Fixed columns -->
<div class="wt-grid wt-grid-3 gap-4">
    <div class="wt-card">Column 1</div>
    <div class="wt-card">Column 2</div>
    <div class="wt-card">Column 3</div>
</div>
```

### App Cards (for dashboard-style layouts)

```html
<div class="wt-grid wt-grid-auto gap-6">
    <a href="app1.html" class="wt-app-card">
        <div class="wt-app-icon">🧪</div>
        <div class="wt-app-info">
            <h3 class="wt-app-title">Dose Predictor</h3>
            <p class="wt-app-description">Predict chemical dosing requirements</p>
        </div>
    </a>
    
    <a href="app2.html" class="wt-app-card">
        <div class="wt-app-icon">📊</div>
        <div class="wt-app-info">
            <h3 class="wt-app-title">Data Analyzer</h3>
            <p class="wt-app-description">Analyze treatment plant data</p>
        </div>
    </a>
</div>
```

## 🛠 Utility Classes

### Layout Utilities

```html
<!-- Flexbox -->
<div class="flex items-center justify-between gap-4">
    <span>Left content</span>
    <span>Right content</span>
</div>

<!-- Grid -->
<div class="grid grid-cols-3 gap-4">
    <div>Item 1</div>
    <div>Item 2</div>
    <div>Item 3</div>
</div>
```

### Spacing Utilities

```html
<!-- Padding -->
<div class="p-4">Padding on all sides</div>
<div class="p-6">More padding</div>

<!-- Margins -->
<div class="mb-4">Margin bottom</div>
<div class="mt-6">Margin top</div>
```

### Text Utilities

```html
<h1 class="text-3xl font-bold text-primary">Large Primary Heading</h1>
<p class="text-lg text-gray-600">Large gray text</p>
<span class="text-sm font-medium text-accent">Small accent text</span>
```

## 📱 Migration Examples

### Example 1: Updating a Simple App

**Before (old styles):**
```html
<div class="container">
    <div class="header">
        <h1>My App</h1>
    </div>
    <div class="main-content">
        <div class="card">
            <button class="btn-primary">Click Me</button>
        </div>
    </div>
</div>
```

**After (global styles):**
```html
<div class="wt-container">
    <header class="wt-header">
        <div class="wt-header-content">
            <div class="wt-brand">
                <img src="../../city-logos/logo-square.png" alt="Logo" class="wt-logo">
                <div class="wt-brand-text">
                    <h1>My App</h1>
                </div>
            </div>
        </div>
    </header>
    <main>
        <div class="wt-card">
            <button class="wt-btn wt-btn-primary">Click Me</button>
        </div>
    </main>
</div>
```

### Example 2: Dashboard with App Cards

```html
<div class="wt-container">
    <header class="wt-header">
        <div class="wt-header-content">
            <div class="wt-brand">
                <img src="../city-logos/logo-square.png" alt="City Logo" class="wt-logo">
                <div class="wt-brand-text">
                    <h1>Water Treatment Dashboard</h1>
                    <p class="wt-tagline">Tools for water treatment professionals</p>
                </div>
            </div>
        </div>
    </header>

    <main>
        <div class="wt-card mb-6">
            <h2 class="text-2xl font-bold text-primary mb-4">Available Tools</h2>
            <div class="wt-grid wt-grid-auto gap-6">
                <!-- App cards here -->
            </div>
        </div>
    </main>
</div>
```

## 🚀 Implementation Strategy

### Phase 1: Test on Non-Critical Apps
1. Choose 1-2 less important apps to test with
2. Replace their existing CSS with global styles
3. Verify everything works correctly
4. Make adjustments if needed

### Phase 2: Gradual Rollout
1. Update 2-3 more apps
2. Gather feedback on consistency
3. Refine the global styles based on needs

### Phase 3: Full Migration
1. Update remaining apps
2. Remove old CSS files
3. Standardize all applications

## 📋 Migration Checklist

For each app you're converting:

- [ ] Backup existing HTML and CSS files
- [ ] Add global styles link to HTML head
- [ ] Replace container with `wt-container`
- [ ] Update header structure with `wt-header`
- [ ] Convert existing cards to `wt-card`
- [ ] Update buttons to use `wt-btn` classes
- [ ] Convert forms to use `wt-form-group`, `wt-label`, `wt-input`
- [ ] Update grid layouts to use `wt-grid` classes
- [ ] Test responsive behavior on mobile
- [ ] Remove old CSS file references
- [ ] Test all functionality works correctly

## 🎯 Benefits

1. **Consistency**: All apps will have the same look and feel
2. **Maintainability**: Update styles in one place, affects all apps
3. **Efficiency**: Faster development of new features
4. **Accessibility**: Built-in focus states and reduced motion support
5. **Responsive**: Mobile-first design with consistent breakpoints
6. **Performance**: One CSS file cached across all apps

## 🔧 Customization

If you need app-specific styles, create a small additional CSS file:

```css
/* app-specific.css */
.my-special-component {
  /* Custom styles that don't exist in global system */
  background: linear-gradient(45deg, var(--primary-teal), var(--accent-gold));
}
```

Include it after the global styles:
```html
<link rel="stylesheet" href="../../global-styles.css">
<link rel="stylesheet" href="app-specific.css">
```

## 📞 Need Help?

When converting apps:
1. Start with the HTML structure
2. Use utility classes for simple styling
3. Use component classes for complex elements
4. Test on mobile devices
5. Refer to this guide for examples

The global styles are designed to handle 90% of your UI needs while remaining flexible for special cases.