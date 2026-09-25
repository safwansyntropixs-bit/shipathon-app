# Replix Design System & UI Specification

**Document Version:** 1.0.0  
**Effective Date:** September 17, 2026  
**Application:** Replix Mobile Application (`com.skortan.replix`)  
**Styling Framework:** NativeWind v4.2.6 (TailwindCSS v3.4.19)  
**Graphics Engine:** Shopify React Native Skia v2.2.12 & React Native SVG v15.12.1  
**Animation Runtime:** React Native Reanimated v4.1.1  

---

## 1. Executive Overview

The Replix Design System is engineered around a **"Cybernetic Athletics"** visual aesthetic. It combines deep slate surfaces (`#09090B`), dynamic bioluminescent green accents (`#3A9E66`), radial glow backgrounds, and crisp typography (`Outfit`) to deliver a state-of-the-art interface tailored for high-contrast visibility in gym environments.

---

## 2. Core Color Tokens & Palette

Configured in [`tailwind.config.js`](file:///d:/rs/tailwind.config.js) and utilized across components:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                REPLIX COLOR PALETTE                                    │
├───────────────────┬──────────────┬─────────────────────────────────────────────────────┤
│ Token Name        │ Hex Code     │ Semantic Purpose / Usage                            │
├───────────────────┼──────────────┼─────────────────────────────────────────────────────┤
│ **Canvas Dark**   │ `#09090B`    │ Primary application background, root screens        │
│ **Deep Black**    │ `#050505`    │ Modal scrims, settings background, camera borders   │
│ **Surface Light** │ `#121212`    │ Input fields, secondary cards (`brand.bgLight`)     │
│ **Card Surface**  │ `#141414`    │ Settings rows, summary cards, elevated containers   │
│ **Container Dark**│ `#18181B`    │ Button containers, slide tracks, segmented controls │
│ **Slate Dark**    │ `#1C1C1E`    │ Onboarding cards, bottom sheet containers           │
│ **Border Dark**   │ `#27272A`    │ Card strokes, input borders, pill dividers          │
│ **Card Stroke**   │ `#2A2A2A`    │ Background card borders (`brand.card`)              │
├───────────────────┼──────────────┼─────────────────────────────────────────────────────┤
│ **Primary Green** │ `#3A9E66`    │ Brand primary CTA, active states, valid skeleton    │
│ **Accent Green**  │ `#4ADE80`    │ Bright highlighted metrics, level indicators        │
│ **Forest Green**  │ `#2F6B47`    │ Success toast backgrounds, ambient glow tints       │
│ **Success Mint**  │ `#3FA76A`    │ High-accuracy rep badges (`brand.success`)          │
│ **Gradient Mint** │ `#6EE7A0`    │ Tab bar active gradient top stop                    │
│ **Gradient Deep** │ `#1A7A3C`    │ Tab bar active gradient bottom stop                 │
│ **Sage**          │ `#8FAE8E`    │ Legal links, soft subtitles (`brand.sage`)          │
├───────────────────┼──────────────┼─────────────────────────────────────────────────────┤
│ **VIP Gold**      │ `#F0B35C`    │ Pro tier badges, crown icons, paywall headers       │
│ **Podium Gold**   │ `#FDE047`    │ 1st Place leaderboard rank, trophy glow accents     │
│ **Gold Tier**     │ `#FFD700`    │ Gold rank level badge color                         │
├───────────────────┼──────────────┼─────────────────────────────────────────────────────┤
│ **Error Red**     │ `#EF4444`    │ Form warning skeleton, destructive buttons          │
│ **Dark Red**      │ `#DC2626`    │ Critical alert toast stroke                         │
│ **Brand Error**   │ `#D85C5C`    │ Toast error background (`brand.error`)              │
│ **Juggernaut Red**│ `#D20000`    │ Legendary badge accent color                        │
├───────────────────┼──────────────┼─────────────────────────────────────────────────────┤
│ **Bronze**        │ `#CD7F32`    │ Rank Level 1–2 (Rookie, Beginner)                   │
│ **Silver**        │ `#C0C0C0`    │ Rank Level 3–4 (Amateur, Athlete)                   │
│ **Platinum**      │ `#E5E4E2`    │ Rank Level 7–8 (Spartan, Titan)                     │
│ **Mythic Purple** │ `#B533FF`    │ Rank Level 9–10 (Demigod, Olympian)                 │
│ **Sky Blue**      │ `#38BDF8`    │ Statue Trophy badge accent                          │
├───────────────────┼──────────────┼─────────────────────────────────────────────────────┤
│ **Text White**    │ `#FFFFFF`    │ Primary headings, active tab icons, rep counters    │
│ **Text Muted**    │ `#A1A1AA`    │ Secondary descriptions, helper text, timestamps     │
│ **Text Dim**      │ `#71717A`    │ Tertiary subtitles, divider labels, inactive tabs   │
│ **Text Dark**     │ `#52525B`    │ Legal disclaimer copy, disabled CTA text            │
└───────────────────┴──────────────┴─────────────────────────────────────────────────────┘
```

---

## 3. Typography & Text Hierarchy

Replix standardizes on the **Outfit** Google Font family, loaded globally in [`app/_layout.tsx`](file:///d:/rs/app/_layout.tsx#L95-L100):

| Tailwind Class | Font Asset | Weight / Style | Primary Application |
| :--- | :--- | :--- | :--- |
| `font-outfitReg` | `Outfit-Regular.ttf` | 400 Regular | Paragraph copy, descriptions, helper captions |
| `font-outfitMed` | `Outfit-Medium.ttf` | 500 Medium | Subheadings, button labels, time metrics, unit tags |
| `font-outfitBold` | `Outfit-Bold.ttf` | 700 Bold | Screen titles, rep counts, XP totals, leaderboard ranks |
| `font-outfitBlack`| `Outfit-Black.ttf` | 900 Heavy | Large display numerals, trophy titles, splash branding |

### Typography Scale:
- **Hero Display:** `32px – 42px` (line-height `38px – 50px`) -> Onboarding titles, welcome hero.
- **Section Headers:** `20px – 24px` -> Screen headers, workout summary headings.
- **Card Titles:** `16px – 18px` -> Exercise cards, quest names, trophy titles.
- **Body & Subtitles:** `13px – 15px` -> Instructional text, settings descriptions.
- **Badges & Overlines:** `9px – 11px` (uppercase tracking: `1px – 4px`) -> Category overlines, level tags.

---

## 4. Radii, Spacing, & Elevation Geometry

- **Pill Geometry (`rounded-full`):** Used for all primary action buttons, tab bars, avatar frames, XP badges, and status chips.
- **Card Geometry (`rounded-2xl` / `16px`):** Used for all elevated containers, workout summary cards, settings sections, and modal dialogs.
- **Tile Geometry (`rounded-xl` / `12px`):** Used for nested grid metrics (e.g., Max PR boxes, country selection rows).
- **Glassmorphism & Borders:**
  - Standard border: `border border-white/10` or `border border-[#27272A]`.
  - Subtle divider: `border-b border-white/5`.
  - Ambient Glow: Radial gradients layered with `opacity-10` to `opacity-30` behind surface elements.

---

## 5. Reusable Custom Component Library

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   REPLIX CORE COMPONENT CATALOG                                         │
├──────────────────────────┬─────────────────────────────┬────────────────────────────────────────────────┤
│ Component Name           │ Source File Path            │ Key Props & Configuration                      │
├──────────────────────────┼─────────────────────────────┼────────────────────────────────────────────────┤
│ `PremiumAmbientBackground`│ `components/layout/`        │ `color?: string`, `opacity?: number`           │
│ `AnimatedSegmentedControl`│ `components/ui/`            │ `options: Array<{label, value, isLocked}>`,   │
│                          │                             │ `activeOption: string`, `onOptionPress()`      │
│ `SaveButton`             │ `components/ui/`            │ `isSaving: boolean`, `isSaved: boolean`,       │
│                          │                             │ `hasChanges: boolean`, `variant: "fab"|"pill"` │
│ `UserAvatar`             │ `components/ui/`            │ `avatarUrl?: string`, `initials: string`,      │
│                          │                             │ `size?: number`, `className?: string`          │
│ `ProVisibilityGate`      │ `components/ui/`            │ `showLockIcon?: boolean`, `iconType?: "crown"`,│
│                          │                             │ `fallback?: ReactNode`, `invert?: boolean`     │
│ `XPToast`                │ `components/ui/`            │ `title: string`, `xpAmount: number`,           │
│                          │                             │ `theme: "default"|"trophy"`, `imageSource`     │
│ `SkeletonLoader`         │ `components/loaders/`       │ `width`, `height`, `borderRadius`, `className` │
│ `RippleRing`             │ `components/loaders/`       │ `color: string`, `delay: number`               │
│ `LockedFeatureModal`     │ `components/modals/`        │ `visible: boolean`, `title: string`,           │
│                          │                             │ `description: string`, `onUpgradePress()`      │
│ `CelebrationModal`       │ `components/modals/`        │ `visible: boolean`, `data: CelebrationData`,   │
│                          │                             │ `onClose: () => void`                          │
│ `SkeletonOverlay`        │ `components/workout/`       │ `landmarks: Point3D[]`, `isValid: boolean`,    │
│                          │                             │ `exercise: string`                             │
│ `CameraPreview`          │ `components/workout/`       │ Native CameraX / AVFoundation view manager     │
│ `ProfileTrophyTabBar`    │ `components/ui/`            │ `activeTab`, `onTabChange`, `trophyTimeframe`, │
│                          │                             │ `onTimeframeChange`, `achievementsCount`       │
└──────────────────────────┴─────────────────────────────┴────────────────────────────────────────────────┘
```

---

## 6. Third-Party UI & Animation Dependencies

Replix deliberately avoids heavyweight monolithic UI frameworks (such as React Native Paper or NativeBase) in favor of high-performance native-driven primitives:

1. **NativeWind (`nativewind` v4.2.6):** Compiles Tailwind CSS utility classes directly into React Native StyleSheets at build time.
2. **Shopify React Native Skia (`@shopify/react-native-skia` v2.2.12):** Powers hardware-accelerated 2D Canvas rendering for dynamic 60 FPS skeletal animations during onboarding.
3. **React Native Reanimated (`react-native-reanimated` v4.1.1):** Drives all UI-thread spring physics, bottom sheet drawer interpolations, and sticky header animations.
4. **React Native SVG (`react-native-svg` v15.12.1):** Renders real-time joint coordinates and skeletal bones during active workouts.
5. **Lucide React Native (`lucide-react-native` v1.25.0):** Provides consistent, modern iconography across all navigation tabs and feature cards.
6. **Expo Blur (`expo-blur` v15.0.8):** Delivers native Gaussian blur effects for Pro paywall teasers and modal overlays.
