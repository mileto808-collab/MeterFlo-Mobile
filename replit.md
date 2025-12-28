# MeterFlo Mobile

## Overview

MeterFlo Mobile is a React Native/Expo mobile application for field technicians to manage water meter work orders. It connects to a MeterFlo Server backend for authentication, work order synchronization, and workflow processing. The app supports offline-first functionality, allowing technicians to view and update work orders without network connectivity, with changes syncing when back online.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 54 (new architecture enabled)
- **Navigation**: React Navigation v7 with tab-based main navigation and native stack navigators
  - 4 main tabs: Work Orders, Sync, Columns, Account
  - Modal screens for detail views, filters, and workflow wizards
- **State Management**: 
  - React Context for global state (Auth, Offline, WorkOrders)
  - TanStack Query for server state management
- **Styling**: Custom theming system with light/dark mode support, consistent spacing and typography constants
- **Animations**: React Native Reanimated for gesture-based interactions and transitions

### Backend Architecture
- **Server**: Express.js server handling API proxy and authentication
- **Database**: PostgreSQL with Drizzle ORM (schema defined, migrations ready)
- **Current Implementation**: Mock authentication endpoint with demo credentials (demo/demo123)
- **Intended Pattern**: Server acts as proxy to external MeterFlo Server instances configured per-user

### Data Storage Solutions
- **Secure Storage**: Expo SecureStore for authentication tokens and credentials (encrypted on-device)
- **Async Storage**: React Native AsyncStorage for cached work orders and pending actions queue
- **Offline Queue**: Pending actions stored locally and synced when connectivity restored

### Authentication Flow
1. User enters MeterFlo Server URL and credentials on login screen
2. App authenticates against the configured server
3. User selects project from available projects list
4. Session maintained via secure token storage
5. Supports "Remember Me" for persistent sessions

### Offline-First Design
- Network status monitored via NetInfo
- Work orders cached locally for offline access
- Changes queued as pending actions with timestamp
- Automatic sync attempted when connectivity restored
- Visual indicators for sync status and pending changes

### Workflow Wizard Features
- **Trouble Code Display**: Trouble codes display with labels (e.g., "02 - Unsafe") for better readability
- **Photo Upload**: Photos captured during workflows are converted to base64 and sent to server
  - Uses expo-image-manipulator for reliable base64 conversion (1200px width, 0.7 quality JPEG compression)
  - `trouble_photos`: Base64 array for trouble path photos
  - `before_photos`: Base64 array for before meter photos (success path)
  - `after_photos`: Base64 array for after meter photos (success path)
  - User feedback when photo conversion fails with option to continue or cancel
- **Server Payload Fields**: Uses snake_case fields per server API requirements
  - `updated_by`: Username (not display name) for tracking changes
  - `completed_by`: User ID for completion attribution

### Sync History Tracking
- **SyncHistoryEntry Interface**: Tracks timestamp, work order IDs/titles, status, counts, photo count, error messages
- **Persistent Storage**: Sync history stored in AsyncStorage under "meterflo_sync_history" (limited to 20 entries)
- **Direct Submission History**: Tracks online submissions separately from queued offline actions
- **Photo Count Tracking**: Pending actions include photoCount for accurate history when syncing queued actions
- **Error Handling**: History recording wrapped in try/catch to prevent AsyncStorage failures from breaking app flow

### Key Design Patterns
- **Path Aliases**: `@/` maps to `client/`, `@shared/` maps to `shared/`
- **Component Structure**: Themed components (ThemedText, ThemedView) for consistent styling
- **Error Handling**: ErrorBoundary with fallback UI and restart capability
- **Platform Compatibility**: KeyboardAwareScrollViewCompat for cross-platform keyboard handling

## External Dependencies

### Third-Party Services
- **MeterFlo Server**: External API for work order management (user-configurable URL)
- **Authentication**: Session-based auth with the MeterFlo Server

### Key Libraries
- **expo-secure-store**: Encrypted credential storage
- **@react-native-async-storage/async-storage**: Local data persistence
- **@react-native-community/netinfo**: Network connectivity monitoring
- **react-native-gesture-handler**: Touch gesture handling
- **react-native-reanimated**: Animation engine
- **drizzle-orm**: Database ORM (PostgreSQL)
- **@tanstack/react-query**: Server state management

### Database
- PostgreSQL database (requires DATABASE_URL environment variable)
- Drizzle Kit for schema migrations
- Current schema: users table with id, username, password fields