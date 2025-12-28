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
- **Server**: Express.js server serves landing page and Expo static files only
- **Database**: PostgreSQL with Drizzle ORM (schema defined, migrations ready)
- **API Backend**: Mobile app connects to external WorkFlow Pro server (entered during login)
- **API Endpoints**: Mobile app uses a mix of project-scoped and mobile-specific endpoints:
  - `POST /api/auth/local/login` - Authentication
  - `GET /api/users/{userId}/projects` - Get user's available projects
  - `GET /api/projects/{projectId}/mobile/sync/download` - Download work orders to mobile
  - `POST /api/projects/{projectId}/mobile/sync/upload` - Upload completed work orders from mobile (batch sync)
  - `POST /api/mobile/workorders/{id}/complete` - Complete a meter changeout with photos (mobile-specific)
  - `POST /api/mobile/workorders/{id}/trouble` - Submit a trouble code with photos (mobile-specific)
  - `POST /api/projects/{projectId}/work-orders/{id}/claim` - Claim a work order
  - `GET /api/projects/{projectId}/work-orders/{id}` - Fetch single work order

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

### Full Sync Behavior
- **Pull-to-refresh and Sync button both trigger full syncs** to get fresh data from server
- **Work order removal**: When a work order is no longer returned by the server (e.g., admin processed it), it's removed from the device
- **Pending changes preserved**: Work orders with `syncPending=true` are never removed, ensuring offline completions aren't lost
- **Sync clearing logic**: After successful sync, `syncPending` flag only cleared for work orders where ALL pending actions were synced (prevents premature badge removal if some actions fail)
- **Offline completion sync**: Offline completions now use individual mobile endpoints (`/api/mobile/workorders/{id}/complete` or `/trouble`) with properly formatted camelCase payloads and photo objects, ensuring offline and online completions use identical API format
- **Edit completed orders**: Completed/trouble work orders can be edited via "Edit Completion" button, which launches the wizard with pre-filled data (skipping the "Can Meter Be Changed?" step)

### Workflow Wizard Features
- **Trouble Code Display**: Trouble codes display with labels (e.g., "02 - Unsafe") for better readability
- **Photo Upload**: Photos captured during workflows are converted to base64 and sent to server
  - Uses expo-image-manipulator for reliable base64 conversion (1200px width, 0.7 quality JPEG compression)
  - Photos sent as objects: `[{ base64: "data:image/jpeg;base64,...", filename: "before_1.jpg" }]`
  - User feedback when photo conversion fails with option to continue or cancel
- **Signature Capture**: Uses react-native-view-shot to capture signature as base64 PNG
  - SignaturePad renders SVG paths but captures as PNG for server compatibility
  - Output format: `data:image/png;base64,...`
- **Mobile API Payload Fields**: Uses camelCase fields for mobile-specific endpoints
  - Trouble: `{ projectId, troubleCode, notes, oldMeterReading, photos }`
  - Complete: `{ projectId, oldMeterReading, newMeterId, newMeterReading, gpsCoordinates, signatureData, signatureName, completedAt, beforePhotos, afterPhotos }`

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