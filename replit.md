# MeterFlo Mobile

## Overview
MeterFlo Mobile is a React Native/Expo application designed for field technicians to manage water meter work orders. It offers offline-first capabilities, allowing technicians to perform tasks without an internet connection and synchronize data once connectivity is restored. The application integrates with a MeterFlo Server backend for authentication, work order synchronization, and workflow processing. Its purpose is to streamline field operations, enhance efficiency, and ensure data integrity even in remote environments.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 54 (new architecture enabled).
- **Navigation**: React Navigation v7 with tab-based main navigation (Work Orders, Sync, Account) and native stack navigators. Modal screens are used for detailed views, filters, and workflow wizards.
- **State Management**: React Context for global state (Auth, Offline, WorkOrders) and TanStack Query for server state.
- **Styling**: Custom theming system supporting light/dark modes, consistent spacing, and typography.
- **Animations**: React Native Reanimated for gesture-based interactions and transitions.

### Backend Architecture
- **Server**: Express.js, primarily serving static files and landing pages.
- **Database**: PostgreSQL with Drizzle ORM for schema management and migrations.
- **API Backend**: The mobile app connects to a user-configurable external WorkFlow Pro server.
- **API Endpoints**: Mix of project-scoped and mobile-specific endpoints for authentication, project retrieval, work order download/upload, and specific mobile workflows like meter changeout and trouble submissions.
- **Data Storage**: Expo SecureStore for encrypted credentials, React Native AsyncStorage for cached work orders and an offline queue.
- **Offline-First Design**: Monitors network status, caches work orders locally, queues pending actions, and automatically syncs when online. Includes visual indicators for sync status.
- **Offline Login**: Caches credentials for local validation when offline, transitioning to an "offline session" mode. Revalidates sessions silently upon reconnect.
- **Full Sync Behavior**: Supports pull-to-refresh and sync buttons for full data synchronization. Handles removal of server-processed work orders while preserving local pending changes. Offline completions use specific mobile endpoints.
- **Multi-User Conflict Handling**: Employs a unified `checkWorkOrderConflict()` helper for both online and offline paths to detect and manage conflicts (e.g., work orders claimed or completed by other users).
- **Workflow Wizard**: Supports trouble code display with labels, photo uploads (base64 conversion with compression), and signature capture (base64 PNG). Uses camelCase for mobile API payloads.
- **Search Functionality**: Unified multi-field search across system ID, module ID, work order ID, and service address, searching local cache first then the server. Displays status for found/not found, and handles already completed work orders.
- **Match Type Detection**: Shared `determineMatchFieldType()` helper in ScanConfirmModal with priority ordering: System ID > Module ID > Work Order ID > Address. Work Order ID matches both customerWoId and internal ID. The `findHighestPriorityMatchType()` helper finds the best label when multiple matches exist. All search paths (manual, scan, server) use these helpers for consistent "Matched by X" labels.
- **Terminology Migration**: Adapts to backend changes from "meter" to "system" terminology, with backward compatibility and local data migration.
- **Offline Lookup Key Consistency**: All identifiers (system ID, module ID) are normalized by trimming whitespace at both storage and sync time. Pending actions store a `lookupKey` field to ensure consistent matching during sync. Startup migrations clean up legacy data with mismatched or missing lookup keys.
- **Android Auto-Update System**: Integrates with GitHub releases for automatic APK updates on Android, configurable by the server and user preferences.

### Key Design Patterns
- **Path Aliases**: `@/` for `client/` and `@shared/` for `shared/`.
- **Component Structure**: Themed components for consistent UI.
- **Error Handling**: ErrorBoundary with fallback UI.
- **Platform Compatibility**: KeyboardAwareScrollViewCompat for cross-platform keyboard management.

## External Dependencies

### Third-Party Services
- **MeterFlo Server**: Primary external API for work order management, with a user-configurable URL.
- **GitHub API**: Used for checking and downloading updates in the Android auto-update system.

### Key Libraries
- **expo-secure-store**: For secure, encrypted storage of sensitive data.
- **@react-native-async-storage/async-storage**: For local persistent data storage.
- **@react-native-community/netinfo**: For monitoring network connectivity status.
- **react-native-gesture-handler**: For handling touch and gesture interactions.
- **react-native-reanimated**: For building smooth animations and transitions.
- **@tanstack/react-query**: For efficient server state management and data fetching.
- **expo-image-manipulator**: For client-side image processing, especially for photo uploads.
- **react-native-view-shot**: For capturing views as images, used for signature capture.

### Database
- **PostgreSQL**: The relational database used by the MeterFlo server backend.
- **Drizzle ORM**: The Object-Relational Mapper used for interacting with PostgreSQL.