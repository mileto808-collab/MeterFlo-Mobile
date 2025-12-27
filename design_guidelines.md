# MeterFlo Mobile - Design Guidelines

## Architecture Decisions

### Authentication
**Auth Required**: Yes - Local credential authentication
- **Implementation**:
  - Username/password login screen with MeterFlo Server REST API validation
  - Securely store auth token using Expo SecureStore (encrypted on-device storage)
  - Session persistence (keep user logged in until explicit logout)
  - Offline access with cached credentials
  - Login screen must include:
    - Server URL configuration field (for connecting to MeterFlo Server instance)
    - "Remember Me" toggle
    - Clear error messaging for failed login attempts
    - Loading state during authentication
  - Account screen must have:
    - Display current user info (name, role, server connection status)
    - Sync status indicator
    - Log out with confirmation alert
    - Server settings (URL configuration)

### Navigation
**Root Navigation**: Tab Navigation (4 tabs + FAB)
- **Tab 1 (Home)**: Work Orders - Main list view with filters
- **Tab 2**: Sync - Queue status and sync management
- **Tab 3**: Columns - Column customization settings
- **Tab 4**: Account - User profile and app settings
- **Floating Action Button**: Quick action for creating new work order updates or processing workflow

### Screen Specifications

#### 1. Login Screen (Stack-Only, Pre-Auth)
- **Purpose**: Authenticate user with MeterFlo Server credentials
- **Layout**:
  - No header (full screen)
  - Centered card with logo area, input fields, and submit button
  - Content should be vertically centered
  - Safe area insets: top = insets.top + Spacing.xl, bottom = insets.bottom + Spacing.xl
- **Components**:
  - MeterFlo logo placeholder (top of card)
  - Server URL input field with validation
  - Username input field
  - Password input field with show/hide toggle
  - "Remember Me" checkbox
  - Primary login button
  - Version number footer (bottom of screen)
- **Behavior**: Submit button disabled until all fields valid

#### 2. Work Orders List (Home Tab)
- **Purpose**: Browse, search, and filter work orders
- **Layout**:
  - Custom transparent header with search bar integrated
  - Header left: Filter icon button (shows active filter count badge)
  - Header right: Sort icon button
  - Scrollable list (FlatList) of work order cards
  - Pull-to-refresh functionality
  - Safe area insets: top = headerHeight + Spacing.xl, bottom = tabBarHeight + Spacing.xl
- **Components**:
  - Search bar (in header, collapsible on scroll)
  - Work order cards showing: ID, title, status badge, assigned user, date, priority indicator
  - Empty state when no work orders match filters
  - Offline indicator banner (fixed at top when offline)
  - Sync pending indicator on modified cards
- **Behavior**: Tap card to navigate to detail view

#### 3. Work Order Detail Screen (Modal Stack)
- **Purpose**: View and process individual work order with workflow actions
- **Layout**:
  - Default navigation header with title showing work order ID
  - Header left: Back button
  - Header right: Overflow menu (share, refresh)
  - Scrollable content area
  - Safe area insets: top = Spacing.xl, bottom = Spacing.xl
- **Components**:
  - Status indicator chip (top of content)
  - Key fields section (grid layout): Priority, Assigned To, Due Date, Location
  - Description section (expandable)
  - Workflow wizard button (primary action, sticky at bottom or floating)
  - Activity log/notes section
  - Metadata section (Created, Modified timestamps)
- **Behavior**: Workflow button launches workflow modal

#### 4. Workflow Wizard Modal (Native Modal)
- **Purpose**: Guide user through work order processing steps matching MeterFlo Server workflow
- **Layout**:
  - Modal header with progress indicator (step X of Y)
  - Header left: Cancel button
  - Header right: Skip button (if allowed)
  - Scrollable form area
  - Submit/Next buttons below form
  - Safe area insets: top = Spacing.xl, bottom = insets.bottom + Spacing.xl
- **Components**:
  - Step progress bar
  - Dynamic form fields based on workflow configuration
  - Previous/Next navigation buttons
  - Final submit button (last step)
- **Behavior**: Validate each step before allowing progression; queue action if offline

#### 5. Filter & Sort Screen (Modal Stack)
- **Purpose**: Configure search filters and sort options for work orders
- **Layout**:
  - Default header with "Filters" or "Sort" title
  - Header left: Cancel button
  - Header right: Apply button OR Reset button
  - Scrollable form (grouped sections)
  - Safe area insets: top = Spacing.xl, bottom = insets.bottom + Spacing.xl
- **Components**:
  - Filter sections: Status, Priority, Assigned User, Date Range
  - Sort options: radio group for field selection + ascending/descending toggle
  - Active filter count indicator
  - Clear all button at bottom
- **Behavior**: Apply button closes modal and refreshes list

#### 6. Column Customization Screen (Columns Tab)
- **Purpose**: Customize which columns appear in work order list view
- **Layout**:
  - Default header with "Columns" title
  - Header right: Save button
  - Scrollable list with drag handles
  - Safe area insets: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl
- **Components**:
  - Draggable list items with checkboxes and drag handles
  - Toggle switches for show/hide per column
  - Reorder instructions text
  - Reset to default button at bottom
- **Behavior**: Drag to reorder, toggle to show/hide, save to apply changes

#### 7. Sync Status Screen (Sync Tab)
- **Purpose**: Monitor offline queue and manually trigger sync
- **Layout**:
  - Default header with "Sync Status" title
  - Header right: Sync all button (disabled when offline)
  - Scrollable content
  - Safe area insets: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl
- **Components**:
  - Connection status card (online/offline with icon)
  - Last sync timestamp
  - Pending actions queue list (expandable items showing action type, target work order)
  - Sync progress indicator when syncing
  - Manual sync button (large, primary)
- **Behavior**: Auto-sync when connection restored; show conflict alerts if needed

#### 8. Account Screen (Account Tab)
- **Purpose**: User profile, settings, and server configuration
- **Layout**:
  - Default header with "Account" title
  - Scrollable content with grouped sections
  - Safe area insets: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl
- **Components**:
  - User profile section: Avatar (placeholder icon), name, email, role
  - Server info section: Connected server URL, connection status
  - Settings section: Theme toggle, notification preferences
  - App info: Version number, last sync time
  - Log out button (destructive style, requires confirmation)
- **Behavior**: Log out clears secure storage and returns to login

## Design System

**Style**: Modern Enterprise Dashboard (inspired by Linear, Notion, Carbon)  
**Typography**: Inter (primary), JetBrains Mono (monospace for IDs/data)  
**Border Radius**: 8px (0.5rem) - use consistently  
**Focus on**: Data readability, quick task completion, minimal cognitive load

### Color Palette (HSL Format)

#### Light Mode
- **Background**: hsl(0, 0%, 100%) - Pure white
- **Card/Surface**: hsl(0, 0%, 98%) - Slightly off-white
- **Muted**: hsl(220, 10%, 94%) - Subtle backgrounds
- **Primary**: hsl(217, 91%, 45%) - Vibrant blue
- **Text Primary**: hsl(220, 10%, 15%) - Near black
- **Text Secondary**: hsl(220, 10%, 35%) - Muted foreground
- **Border**: hsl(220, 5%, 88%)
- **Success**: hsl(142, 69%, 35%) - Green
- **Error/Destructive**: hsl(0, 84%, 42%) - Red
- **Warning**: hsl(38, 92%, 50%) - Amber

#### Dark Mode
- **Background**: hsl(220, 6%, 8%) - Near black
- **Card/Surface**: hsl(220, 6%, 10%)
- **Muted**: hsl(220, 10%, 16%)
- **Primary**: hsl(217, 91%, 55%) - Brighter blue for dark mode
- **Text Primary**: hsl(220, 6%, 92%) - Light text
- **Text Secondary**: hsl(220, 10%, 65%)
- **Border**: hsl(220, 6%, 18%)
- **Success**: hsl(142, 69%, 45%)
- **Error/Destructive**: hsl(0, 84%, 48%)
- **Warning**: hsl(38, 92%, 55%)

#### Status Badge Colors
Status badges use tinted backgrounds with contrasting text:
- **Open**: Transparent bg, border visible, muted text
- **Scheduled**: Blue tint bg, dark blue text
- **In Progress**: Yellow/amber tint bg, dark amber text
- **Completed**: Green tint bg, dark green text
- **Cancelled**: Red tint bg, dark red text
- **Trouble**: Amber tint bg, dark amber text

### Typography Scale
- **Page Title**: 30px, Bold - Main screen headings
- **Section Header**: 20px, Semibold - Section headings
- **Card Title**: 18px, Medium - Card headings
- **Body**: 16px, Regular - Main content, readable for field workers
- **Label**: 14px, Medium - Form labels
- **Small**: 14px, Regular - Secondary info, metadata
- **Caption**: 12px, Regular - Timestamps, badges
- **Button**: 16px, Semibold - Call-to-action text
- **Mono**: 14px, Regular - IDs, readings, timestamps (JetBrains Mono)

### Component Specifications

**Buttons**:
- Height: 36px (default), 32px (small), 40px (large), 36x36px (icon)
- Border radius: 6px
- Primary: Primary background, white text
- Secondary: Secondary background, foreground text
- Ghost: Transparent background, foreground text
- Destructive: Destructive background, white text
- Hover: Apply elevate1 overlay
- Pressed: Apply elevate2 overlay

**Cards**:
- Background: Card color
- Border: 1px solid cardBorder
- Border radius: 8px
- Padding: 16px (or 24px for larger cards)
- NO drop shadow (flat design for data density)

**Inputs**:
- Height: 40px
- Border: 1px solid input border color
- Border radius: 6px
- Background: Background color
- Focus: 2px ring with ring color

**Work Order Cards**:
- Card background with 1px border (cardBorder color)
- 8px corner radius (BorderRadius.md)
- 16px padding
- Tap feedback: slight opacity change (0.7) and scale (0.98)

**Status Badges**:
- Padding: 4px horizontal, 2px vertical
- Border radius: 6px (or full for pill shape)
- Font size: 12px, weight 500
- Tinted backgrounds with contrasting text (see Status Badge Colors)
- "Open" status has visible border instead of colored background

**Search Bar**:
- 40px height
- Muted background
- 8px corner radius
- Magnifying glass icon left, clear button right
- 14px placeholder text

**Offline Indicator Banner**:
- Full-width bar at top of screen
- Warning color background
- White text: "Offline Mode - Changes will sync when connected"
- 8px vertical padding
- Icon left (wifi-off)

### Accessibility
- Minimum touch target: 44x44px for all interactive elements
- Color contrast ratio 4.5:1 for text
- Loading states for all async operations
- Error messages clearly visible and announced
- Support dynamic text sizing
- Offline mode clearly indicated with both color AND icon
- Form fields with proper labels for screen readers

### Assets Required
- **Logo**: MeterFlo wordmark for login screen (SVG, 200x60px)
- **Icons**: Use Feather icon set from @expo/vector-icons
  - filter, sort, refresh, wifi-off, check-circle, alert-circle, user, settings, list, grid
- NO custom illustrations or decorative imagery (professional utility app)