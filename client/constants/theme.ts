import { Platform } from "react-native";

// MeterFlo Theme - Modern Enterprise Dashboard
// Inspired by Linear, Notion, Carbon design systems
// Typography: Inter (primary), JetBrains Mono (monospace for IDs/data)

export const Colors = {
  light: {
    // Base
    text: "hsl(220, 10%, 15%)",                    // Near black text (foreground)
    textSecondary: "hsl(220, 10%, 35%)",           // Muted foreground
    buttonText: "hsl(217, 91%, 98%)",              // White text on primary
    
    // Tab navigation
    tabIconDefault: "hsl(220, 10%, 35%)",
    tabIconSelected: "hsl(217, 91%, 45%)",
    
    // Links
    link: "hsl(217, 91%, 45%)",
    
    // Backgrounds
    backgroundRoot: "hsl(0, 0%, 100%)",            // Pure white (background)
    backgroundDefault: "hsl(0, 0%, 98%)",          // Slightly off-white (card)
    backgroundSecondary: "hsl(220, 10%, 94%)",     // Muted background
    backgroundTertiary: "hsl(220, 8%, 92%)",       // Secondary background
    
    // Borders
    border: "hsl(220, 5%, 88%)",
    cardBorder: "hsl(220, 4%, 94%)",
    
    // Primary (Blue)
    primary: "hsl(217, 91%, 45%)",                 // Vibrant blue
    primaryForeground: "hsl(217, 91%, 98%)",
    
    // Secondary (Gray)
    secondary: "hsl(220, 8%, 92%)",
    secondaryForeground: "hsl(220, 10%, 15%)",
    
    // Accent
    accent: "hsl(220, 12%, 93%)",
    accentForeground: "hsl(220, 10%, 15%)",
    
    // Semantic colors
    success: "hsl(142, 69%, 35%)",
    error: "hsl(0, 84%, 42%)",                     // Destructive
    warning: "hsl(38, 92%, 50%)",
    syncPending: "hsl(270, 60%, 60%)",
    
    // Input fields
    input: "hsl(220, 10%, 70%)",
    inputBorder: "hsl(220, 10%, 70%)",
    
    // Focus ring
    ring: "hsl(217, 91%, 45%)",
    
    // Elevation overlays
    elevate1: "rgba(0, 0, 0, 0.03)",               // Subtle hover
    elevate2: "rgba(0, 0, 0, 0.08)",               // Active/pressed
  },
  dark: {
    // Base
    text: "hsl(220, 6%, 92%)",                     // Light text (foreground)
    textSecondary: "hsl(220, 10%, 65%)",           // Muted foreground
    buttonText: "hsl(217, 91%, 98%)",              // White text on primary
    
    // Tab navigation
    tabIconDefault: "hsl(220, 10%, 65%)",
    tabIconSelected: "hsl(217, 91%, 55%)",
    
    // Links
    link: "hsl(217, 91%, 55%)",
    
    // Backgrounds
    backgroundRoot: "hsl(220, 6%, 8%)",            // Near black (background)
    backgroundDefault: "hsl(220, 6%, 10%)",        // Card background
    backgroundSecondary: "hsl(220, 10%, 16%)",     // Muted background
    backgroundTertiary: "hsl(220, 8%, 18%)",       // Secondary background
    
    // Borders
    border: "hsl(220, 6%, 18%)",
    cardBorder: "hsl(220, 6%, 14%)",
    
    // Primary (Blue - slightly brighter for dark mode)
    primary: "hsl(217, 91%, 55%)",
    primaryForeground: "hsl(217, 91%, 98%)",
    
    // Secondary
    secondary: "hsl(220, 8%, 18%)",
    secondaryForeground: "hsl(220, 6%, 92%)",
    
    // Accent
    accent: "hsl(220, 12%, 18%)",
    accentForeground: "hsl(220, 6%, 92%)",
    
    // Semantic colors
    success: "hsl(142, 69%, 45%)",
    error: "hsl(0, 84%, 48%)",                     // Destructive
    warning: "hsl(38, 92%, 55%)",
    syncPending: "hsl(270, 60%, 65%)",
    
    // Input fields
    input: "hsl(220, 10%, 30%)",
    inputBorder: "hsl(220, 10%, 30%)",
    
    // Focus ring
    ring: "hsl(217, 91%, 55%)",
    
    // Elevation overlays
    elevate1: "rgba(255, 255, 255, 0.04)",         // Subtle hover
    elevate2: "rgba(255, 255, 255, 0.09)",         // Active/pressed
  },
};

// Status Badge Colors for Work Order statuses
export const StatusBadgeColors = {
  light: {
    Open: { bg: "transparent", border: "hsl(220, 5%, 88%)", text: "hsl(220, 10%, 35%)" },
    Scheduled: { bg: "hsl(214, 95%, 93%)", border: "transparent", text: "hsl(214, 95%, 30%)" },
    "In Progress": { bg: "hsl(48, 96%, 89%)", border: "transparent", text: "hsl(32, 95%, 30%)" },
    Completed: { bg: "hsl(142, 69%, 90%)", border: "transparent", text: "hsl(142, 69%, 25%)" },
    Cancelled: { bg: "hsl(0, 84%, 95%)", border: "transparent", text: "hsl(0, 84%, 42%)" },
    Trouble: { bg: "hsl(38, 92%, 90%)", border: "transparent", text: "hsl(32, 95%, 30%)" },
  },
  dark: {
    Open: { bg: "transparent", border: "hsl(220, 6%, 18%)", text: "hsl(220, 10%, 65%)" },
    Scheduled: { bg: "hsl(214, 95%, 15%)", border: "transparent", text: "hsl(214, 95%, 80%)" },
    "In Progress": { bg: "hsl(48, 96%, 15%)", border: "transparent", text: "hsl(48, 96%, 80%)" },
    Completed: { bg: "hsl(142, 69%, 12%)", border: "transparent", text: "hsl(142, 69%, 75%)" },
    Cancelled: { bg: "hsl(0, 84%, 15%)", border: "transparent", text: "hsl(0, 84%, 75%)" },
    Trouble: { bg: "hsl(38, 92%, 15%)", border: "transparent", text: "hsl(38, 92%, 75%)" },
  },
};

// Spacing System (in pixels)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
  "5xl": 56,
  inputHeight: 40,      // Updated to match MeterFlo Server (40px)
  buttonHeight: 36,     // Updated to match MeterFlo Server (36px default)
  buttonHeightSmall: 32,
  buttonHeightLarge: 40,
  iconButton: 36,       // 36x36px for icon buttons
};

// Border Radius - consistent 8px (0.5rem) base
export const BorderRadius = {
  xs: 4,
  sm: 6,                // Buttons, inputs
  md: 8,                // Cards, containers (primary radius)
  lg: 12,
  xl: 16,
  "2xl": 20,
  "3xl": 24,
  full: 9999,           // Pills, badges
};

// Typography Scale
export const Typography = {
  pageTitle: {
    fontSize: 30,
    fontWeight: "700" as const,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "500" as const,
  },
  h1: {
    fontSize: 30,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 24,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  label: {
    fontSize: 14,
    fontWeight: "500" as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  button: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  mono: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
};

// Font Families - using system fonts for native compatibility
export const Fonts = Platform.select({
  ios: {
    sans: "System",             // iOS system font (SF Pro)
    serif: "Georgia",
    rounded: "System",
    mono: "Menlo",              // iOS monospace
  },
  android: {
    sans: "Roboto",             // Android system font
    serif: "serif",
    rounded: "Roboto",
    mono: "monospace",          // Android monospace
  },
  default: {
    sans: "System",
    serif: "serif",
    rounded: "System",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', system-ui, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// Legacy StatusColors for backward compatibility
export const StatusColors = {
  pending: "hsl(220, 10%, 35%)",
  inProgress: "hsl(217, 91%, 45%)",
  completed: "hsl(142, 69%, 35%)",
  urgent: "hsl(0, 84%, 42%)",
  onHold: "hsl(38, 92%, 50%)",
};
