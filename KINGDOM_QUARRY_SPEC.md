# Kingdom Quarry - Game Specification

## 🏰 Game Overview

**Kingdom Quarry** is a fantasy medieval idle game where players manage a mystical mining operation. Characters collect resources from an enchanted quarry, upgrade their workforce and equipment, and sell resources in a dynamic medieval market economy.

## 🎮 Core Game Loop

1. **Resource Collection**: Pixel art miners extract stone and magical crystals from the quarry
2. **Character Progression**: Upgrade miners to knights, then to wizard overseers
3. **Transport Systems**: Upgrade from hand carts to horse carts to magical portals
4. **Market Economy**: Sell resources to medieval vendors with fluctuating prices
5. **Prestige System**: Royal Decree resets with permanent kingdom bonuses

## 📊 Game Systems

### Resource Types
- **Stone**: Basic building material (gray/brown sprites)
- **Magical Crystals**: Rare gems that boost production (blue/purple glow)
- **Gold Coins**: Currency earned from sales (golden sparkle)
- **Royal Favor**: Prestige currency for permanent upgrades

### Character Classes
1. **Peasant Miners** (Level 1-10)
   - Basic pickaxe, brown tunic
   - Collects 1 stone per second base rate
   
2. **Knight Supervisors** (Level 11-25) 
   - Armor and sword, manages multiple miners
   - 3x mining efficiency, unlocks better equipment
   
3. **Wizard Overseers** (Level 26+)
   - Robes and staff, magical enhancement
   - 10x efficiency, unlocks magical transport

### Transport Upgrades
1. **Hand Carts**: Basic wooden carts (1x speed)
2. **Horse Carts**: Faster delivery with horse sprites (3x speed)
3. **Magic Portals**: Instant transport with particle effects (10x speed)
4. **Dragon Riders**: Flying transport with dragon animations (25x speed)

### Market Economy
- **Dynamic Pricing**: Prices fluctuate based on supply/demand
- **Town Criers**: Announce market opportunities
- **Special Orders**: Timed contracts for bonus rewards
- **Royal Commissions**: Prestige-level exclusive orders

## 🎨 Visual Design

### Pixel Art Style
- **Resolution**: 16x16 and 32x32 pixel sprites
- **Color Palette**: 
  - Earth tones: #8B4513, #A0522D, #CD853F
  - Stone grays: #696969, #778899, #DCDCDC  
  - Magic blues: #4169E1, #6495ED, #00BFFF
  - Royal purples/golds: #9932CC, #FFD700, #DAA520

### Animation System
- **Character Movement**: 4-frame walk cycles
- **Resource Collection**: Pickaxe swinging, crystal sparkles
- **Transport Animation**: Cart wheels, horse galloping, portal swirls
- **UI Effects**: Coin collection, level up bursts

### Medieval UI Theme
- **Windows**: Stone-bordered panels with medieval styling
- **Buttons**: Carved stone appearance with hover effects
- **Progress Bars**: Medieval banners and heraldic designs
- **Icons**: Fantasy-themed symbols (swords, shields, crystals)

## 💾 Technical Architecture

### Frontend Structure
```
frontend/idleGame/
├── index.html              # Main game page
├── css/
│   ├── main.css           # Base layout and typography
│   ├── pixel-art.css      # Pixel-perfect rendering rules
│   └── medieval-theme.css # Fantasy medieval styling
├── js/
│   ├── game/
│   │   ├── GameEngine.js          # Main game loop and state
│   │   ├── PixelArtRenderer.js    # Canvas rendering system
│   │   ├── ResourceSystem.js      # Resource collection logic
│   │   ├── CharacterSystem.js     # Character progression
│   │   ├── EconomySystem.js       # Market pricing and sales
│   │   └── PrestigeSystem.js      # Reset and bonuses
│   ├── api/
│   │   ├── AuthService.js         # JWT authentication
│   │   ├── SaveSyncService.js     # Cloud save synchronization
│   │   └── CloudSaveManager.js    # Save conflict resolution
│   ├── utils/
│   │   ├── SpriteManager.js       # Sprite loading and caching
│   │   ├── AnimationController.js # Animation state management
│   │   └── SaveManager.js         # Local storage handling
│   └── main.js            # Application bootstrap
├── assets/
│   ├── sprites/           # All pixel art assets
│   ├── sounds/           # Medieval ambient sounds
│   └── icons/            # PWA and UI icons
├── service-worker.js     # Offline capability
└── manifest.json         # PWA configuration
```

### Backend Integration
- **Database Tables**: Extends existing MySQL schema
- **API Endpoints**: Added to existing FastAPI backend
- **Authentication**: JWT tokens with existing user system integration
- **Real-time**: Optional Socket.IO for leaderboards

### Save System Architecture
```javascript
// Local save structure
{
  gameVersion: "1.0.0",
  playTime: 12345,
  lastSave: "2025-09-30T10:30:00Z",
  resources: {
    stone: 1500,
    crystals: 23,
    gold: 890,
    royalFavor: 5
  },
  characters: [
    { id: 1, type: "miner", level: 8, position: {x: 100, y: 200} },
    { id: 2, type: "knight", level: 15, position: {x: 150, y: 200} }
  ],
  upgrades: {
    miningSpeed: 5,
    transportSpeed: 3,
    marketEfficiency: 2
  },
  buildings: {
    quarry: { level: 3, workers: 8 },
    market: { level: 2, vendors: 3 },
    castle: { level: 1, storage: 5000 }
  },
  achievements: ["first_crystal", "knight_promotion", "royal_decree"],
  settings: {
    soundEnabled: true,
    autoSave: true,
    notifications: true
  }
}
```

## 🛡️ Authentication & Save Management

### JWT Authentication
- **Login Modal**: Medieval-themed overlay with pixel art
- **Token Management**: Secure HTTP-only cookies + localStorage backup
- **Guest Mode**: Full offline functionality without account
- **Account Linking**: Convert guest saves to cloud saves

### Cloud Save Features
- **Automatic Sync**: Save every 30 seconds when online
- **Conflict Resolution**: Choose between local/cloud save with preview
- **Save Backups**: Keep last 10 saves with timestamps
- **Cross-Device**: Seamless play across desktop/mobile

### Offline Support
- **Service Worker**: Cache all game assets and core functionality
- **Save Queue**: Queue saves when offline, sync when reconnected
- **Progressive Enhancement**: Full game works without internet
- **PWA**: Installable on mobile devices

## 🎯 Game Balance

### Progression Curve
- **Early Game** (0-30 min): Learn mechanics, first upgrades
- **Mid Game** (30 min - 2 hours): Character progression, market unlock
- **Late Game** (2+ hours): Optimization, prestige preparation
- **Prestige** (4+ hours): Reset with permanent bonuses

### Idle Mechanics
- **Offline Progress**: Calculate up to 24 hours offline gains
- **Diminishing Returns**: Efficiency drops over time offline
- **Comeback Bonuses**: Bonus resources when returning
- **Active Bonuses**: Better rates when actively playing

### Monetization (Optional)
- **Cosmetic DLC**: Additional character skins and themes
- **Time Boosters**: Optional speed-ups for impatient players
- **Premium Features**: Extra save slots, detailed statistics
- **No Pay-to-Win**: All core progression available free

## 🚀 Implementation Phases

### Phase 1: Core Systems (Week 1)
- [x] Database schema and backend repositories
- [ ] Basic game engine and rendering
- [ ] Resource collection system
- [ ] Local save/load functionality

### Phase 2: Game Mechanics (Week 2)  
- [ ] Character progression system
- [ ] Transport and upgrade systems
- [ ] Market economy implementation
- [ ] Medieval UI and animations

### Phase 3: Cloud Integration (Week 3)
- [ ] JWT authentication system
- [ ] Cloud save synchronization
- [ ] Conflict resolution interface
- [ ] Offline support with service worker

### Phase 4: Polish & Features (Week 4)
- [ ] Prestige system implementation
- [ ] Achievement system
- [ ] Leaderboards and social features
- [ ] Performance optimization and testing

## 📱 Platform Compatibility

### Desktop Browsers
- **Chrome/Edge**: Primary target, full feature support
- **Firefox**: Full compatibility with polyfills
- **Safari**: WebKit optimizations for smooth performance

### Mobile Devices
- **Responsive Design**: Touch-friendly interface scaling
- **PWA Support**: Install as native-like app
- **Performance**: Optimized for lower-end devices
- **Battery Efficiency**: Minimize background processing

### Accessibility
- **Keyboard Navigation**: Full game playable without mouse
- **Screen Reader**: Alt text and ARIA labels for UI
- **Color Blind**: Alternative indicators beyond color
- **Reduced Motion**: Respect prefers-reduced-motion

## 🔧 Development Tools & Standards

### Code Quality
- **ES6+ JavaScript**: Modern syntax with async/await
- **CSS Grid/Flexbox**: Modern layout techniques
- **Web Components**: Reusable UI elements
- **Performance Monitoring**: Frame rate and memory tracking

### Testing Strategy
- **Unit Tests**: Game logic and calculations
- **Integration Tests**: Save/load and API functionality  
- **Performance Tests**: Frame rate under load
- **Cross-Browser**: Automated testing on multiple browsers

### Deployment
- **Version Control**: Git with semantic versioning
- **Build Process**: Asset optimization and minification
- **CDN**: Fast asset delivery worldwide
- **Analytics**: Player behavior and performance metrics

This specification provides the complete roadmap for building Kingdom Quarry as a polished, professional idle game that integrates seamlessly with your existing FastAPI backend and MySQL database.