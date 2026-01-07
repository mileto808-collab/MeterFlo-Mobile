# MeterFlo Mobile

## Overview

MeterFlo Mobile is a React Native/Expo mobile application for field technicians to manage water meter work orders. It connects to a MeterFlo Server backend for authentication, work order synchronization, and workflow processing. The app supports offline-first functionality, allowing technicians to view and update work orders without network connectivity, with changes syncing when back online.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 54 (new architecture enabled)
- **Navigation**: React Navigation v7 with tab-based main navigation and native stack navigators
  - 3 main tabs: Work Orders, Sync, Account
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
  - `GET /api/projects/{projectId}/work-orders/search?systemId=xxx` - Search work orders by system ID (requires server support)

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

### CSRF Protection Headers
All API requests to the MeterFlo server include the following headers for CSRF protection:
- `X-Requested-With: XMLHttpRequest` - Required by most MeterFlo server installations
- `Origin: [serverUrl]` - Set to the user-configured server URL; required by Replit-hosted servers
- `Referer: [serverUrl]/` - Added as fallback for servers that check Referer instead of Origin
- These headers are applied in AuthContext, WorkOrderContext, OfflineContext, and WorkflowWizardScreen

### Offline Login
- **Credential Caching**: On successful online login, credentials are securely stored in SecureStore (device-level encryption via Keychain/Keystore)
- **Offline Verification**: When server is unreachable, app validates credentials locally using stored password hash with salt
- **Offline Session Mode**: App enters "offline session" mode with banner indicator on Account screen
- **Silent Re-authentication**: When connectivity returns, AutoSyncManager triggers session revalidation via `revalidateSession()`, which performs a real login API call to establish a valid server cookie
- **Credential Preservation**: Credentials persist through logout to enable offline re-login
- **Sync Safety**: AutoSyncManager skips sync operations if session revalidation fails, preventing 401 errors

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
- **Auto-sync on reconnect**: When device connectivity is restored after being offline, pending actions are automatically synced with a 2-second debounce. If sync fails, the system retries on subsequent connectivity changes. After successful sync, the Pending badge is automatically cleared via the AutoSyncManager component
- **Local data preservation**: During sync, local completion data (customerWoId, oldSystemId, oldGps, oldSystemReading, newSystemId, newSystemReading, newGps, completedAt, completedBy, troubleCode, troubleNote) is preserved and merged with server data to prevent data loss
- **Edit completed orders**: Completed/trouble work orders can be edited via "Edit Completion" button, which launches the wizard with pre-filled data (skipping the "Can Meter Be Changed?" step)

### Multi-User Conflict Handling
- **Unified Conflict Check**: Shared helper `client/lib/conflict-check.ts` provides `checkWorkOrderConflict()` function used by both online and offline paths
- **Pre-flight Check for Online Submissions**: Before submitting a completion via WorkflowWizardScreen, the app fetches the work order and checks if claimed/completed by another user
- **Pre-flight Check for Offline Sync**: Before syncing each pending action, OfflineContext uses the same helper to detect conflicts
- **Conflict Detection Logic**:
  - If `assigned_to_username` differs from current user → conflict (claimed by another)
  - If status is "completed" or "closed" AND `completed_by_username` differs from current user → conflict (completed by another)
  - Status "Open" with leftover completion data is NOT a conflict (admin reset scenario)
- **Case-insensitive Username Comparison**: All username comparisons are case-insensitive
- **HTTP Conflict Detection**: Also detects HTTP-level claim conflicts (HTTP 409, or 403/400 with "claimed"/"assigned"/"not available" messages)
- **Online Conflict Handling**: Alert shown, local work order deleted, user navigated back to work order list
- **Offline Conflict Handling**: Conflicted actions removed from pending queue, work orders deleted by AutoSyncManager/SyncScreen
- **User Notification**: On manual sync, users are notified how many work orders were removed due to conflicts
- **deleteLocalWorkOrder Function**: WorkOrderContext exposes a function to delete work orders by ID, which also removes embedded photo data

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
  - Trouble: `{ projectId, troubleCode, notes, oldSystemReading, photos }`
  - Complete: `{ projectId, oldSystemReading, newSystemId, newSystemReading, gpsCoordinates, signatureData, signatureName, completedAt, beforePhotos, afterPhotos }`
- **Server-Found Work Order Persistence**: When completing a work order found via server search (not cached locally), the completed work order is automatically added to local storage using upsert logic in `updateWorkOrder`. The base work order is normalized via `normalizeStoredWorkOrder()` to ensure consistent field naming and required fields (createdAt, updatedAt, localUpdatedAt, syncPending) are set.

### Sync History Tracking
- **SyncHistoryEntry Interface**: Tracks timestamp, work order IDs/titles, status, counts, photo count, error messages
- **Persistent Storage**: Sync history stored in AsyncStorage under "meterflo_sync_history" (limited to 20 entries)
- **Direct Submission History**: Tracks online submissions separately from queued offline actions
- **Photo Count Tracking**: Pending actions include photoCount for accurate history when syncing queued actions
- **Error Handling**: History recording wrapped in try/catch to prevent AsyncStorage failures from breaking app flow

### Unified Multi-Field Search
- **All scan methods use unified flow**: Camera barcode, camera QR, HID scanner, and manual search all use consistent search logic
- **Multi-field matching**: Search checks system ID (old/new), work order ID, and service address
  - System IDs: Exact match (case-insensitive)
  - Work Order ID: Exact match on `customerWoId` first; falls back to internal `id` when `customerWoId` is empty
  - Address: Partial match (e.g., "4525 Bison" matches "4525 Bison Drive")
- **Search order**: Locally cached work orders are searched first, then server is queried if online
- **Server endpoint**: `GET /api/projects/:projectId/work-orders/by-system/:searchTerm` - supports multi-field search
- **Unified messaging**: 
  - Found locally: "Matched from cached work orders" (green badge)
  - Found on server: "Matched from server" (blue badge with "Requires Claim")
  - Not found (online): "No work order found in cached work orders or on the server."
  - Not found (offline): "No work order found in cached data. Go online to search the server."
- **Completed work order detection**: When a work order is found but already completed/closed:
  - Shows "Already Completed" title with warning (orange) icon
  - Displays message: "This work order has already been completed and cannot be processed again."
  - Hides "Start System Changeout" button to prevent processing
  - Navigation guard blocks completed work orders from reaching WorkflowWizard
- **Context-aware navigation buttons**: ScanConfirmModal uses `isManualSearch` flag to show context-appropriate buttons
  - Scan-based flows (barcode, QR, HID): Show "Scan Again" and "Edit Search" buttons
  - Manual search: Show only "Edit Search" button (since scanning doesn't apply)
  - Consistent "Start System Changeout" button text across all entry points
- **Loading state**: Modal shows spinner while searching server
- **Empty list state**: "No matches in cached work orders. Use scan to search the server."

### Key Design Patterns
- **Path Aliases**: `@/` maps to `client/`, `@shared/` maps to `shared/`
- **Component Structure**: Themed components (ThemedText, ThemedView) for consistent styling
- **Error Handling**: ErrorBoundary with fallback UI and restart capability
- **Platform Compatibility**: KeyboardAwareScrollViewCompat for cross-platform keyboard handling

### Terminology Migration (Meter → System)
- **Server Change**: Backend changed all "meter" field names to "system" (old_meter_id → old_system_id, etc.)
- **Backward Compatibility**: App accepts both old and new field names from server responses
- **Field Mapping**: ServerWorkOrder interface includes both (old_meter_id and old_system_id), mapServerWorkOrder prioritizes new names with fallback to old
- **Local Storage Migration**: 
  - WorkOrderContext normalizes cached data to new terminology on load
  - OfflineContext migrates pending actions (complete, offlineWorkOrder) from meter to system fields
- **API Payloads**: Now send system terminology (newSystemId, oldSystemReading) to server

### GitHub Auto-Update System (Android)
- **Server Configuration**: Server provides `mobileConfig.updateUrl` in the `/api/users/:userId/projects` response
  - URL should point to GitHub releases API endpoint: `https://api.github.com/repos/{owner}/{repo}/releases/latest`
  - AuthContext parses and stores this URL in SecureStore under `meterflo_update_url`
- **Update Service** (`client/lib/github-update-service.ts`):
  - `checkForUpdate(updateUrl)`: Fetches latest release from GitHub API, compares versions
  - `getCurrentAppVersion()`: Returns app version from expo-constants
  - `compareVersions()`: Semantic version comparison (handles v1.0.0 and 1.0.0 formats)
  - `findApkAsset()`: Locates APK file in release assets by extension or content-type
- **Auto-Update Manager** (`client/components/AutoUpdateManager.tsx`):
  - Runs 3 seconds after authentication
  - Respects 4-hour minimum interval between checks (only written on successful checks)
  - Honors user's enable/disable preference from settings
  - Checks skipped version to avoid re-prompting
  - Integrated in App.tsx alongside AutoSyncManager
- **Update Modal** (`client/components/UpdateAvailableModal.tsx`):
  - Shows release notes, version comparison, file size
  - Android: Downloads APK with progress bar, triggers install via expo-intent-launcher
  - iOS/Web: Opens GitHub release page in browser
  - Security: Enforces HTTPS for APK downloads
  - Options: "Download & Install", "Skip This Version", "Remind Me Later"
- **User Settings** (Account screen):
  - Toggle for auto-update checks with SecureStore persistence
  - Manual "Check for Updates" button
  - Shows update source status (Configured/Not configured)
  - Platform note for iOS/Web users about Android-only automatic updates
- **Storage Keys**:
  - `meterflo_update_url`: Update source URL from server
  - `meterflo_update_check_enabled`: User preference for auto-checks
  - `meterflo_last_update_check`: Timestamp of last successful check
  - `meterflo_skipped_version`: Version user chose to skip
- **Security Considerations**:
  - HTTPS enforcement for APK downloads (rejects non-HTTPS URLs)
  - Server-controlled update source (not hardcoded)
  - User can disable auto-checks
  - Skip version feature prevents unwanted prompts

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