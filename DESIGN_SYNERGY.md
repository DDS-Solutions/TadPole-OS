# 🎨 Tadpole OS Design Synergy Package

To ensure the marketing website matches the OS aesthetics, implement these tokens into your `tadpole-marketing` repository.

## 1. Tailwind Configuration (`tailwind.config.js`)
```javascript
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        zinc: {
          950: '#09090b',
          900: '#18181b',
          800: '#27272a',
        },
        background: '#09090b',
        surface: '#18181b',
        border: '#27272a',
      }
    }
  }
}
```

## 2. Core Styles (`theme.css`)
```css
/* Premium Dot Grid */
.neural-grid {
  position: absolute;
  inset: 0;
  opacity: 0.02;
  pointer-events: none;
  background-image: radial-gradient(circle, #fff 1px, transparent 1px);
  background-size: 40px 40px;
}

/* Intelligence Pulse Animation */
@keyframes neural-pulse {
  0% { opacity: 0.3; filter: drop-shadow(0 0 0px #fff); }
  50% { opacity: 0.8; filter: drop-shadow(0 0 4px #fff); }
  100% { opacity: 0.3; filter: drop-shadow(0 0 0px #fff); }
}

.neural-pulse {
  animation: neural-pulse 2s infinite ease-in-out;
}
```

## 3. Brand Assets
- **Primary Logo**: Located in `tadpole-os/src/assets/logo.png`.
- **Favicon**: Use the Tadpole badge icon.
