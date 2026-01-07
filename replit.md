# MeterFlo Mobile

## Overview

MeterFlo Mobile is an offline-first React Native/Expo application designed for field technicians to manage water meter work orders. It integrates with a MeterFlo Server backend for authentication, work order synchronization, and workflow processing. The app enables technicians to work without network connectivity, syncing changes automatically once reconnected. Key features include secure offline login, multi-user conflict handling, and a guided workflow wizard for tasks like meter changeouts and trouble reporting, including photo and signature capture. The project aims to provide a robust and intuitive tool for efficient field operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React Native with Expo SDK 54 (new architecture enabled).
- **Navigation**: React Navigation v7, utilizing tab-based and native stack navigators, with modal screens for details and workflows.
- **State Management**: React Context for global state (Auth, Offline, WorkOrders) and TanStack Query for server state.
- **Styling**: Custom theming with light/dark mode, consistent spacing, and typography.
- **Animations**: React Native Reanimated for interactive elements.

### Backend
- **Server**: Express.js, serving static files and the landing page.
- **Database**: PostgreSQL with Drizzle ORM for schema management.
- **API Backend**: Connects to an external, user-configured WorkFlow Pro server.
- **Key API Endpoints**:
    - `POST /api/mobile/auth/login` for JWT authentication.
    - `GET /api/projects/{projectId}/mobile/sync/download` for downloading work orders.
    - `POST /api/projects/{projectId}/mobile/sync/upload` for batch uploading completed work orders.
    - Mobile-specific endpoints for completing (`/api/mobile/workorders/{id}/complete`) and troubleshooting (`/api/mobile/workorders/{id}/trouble`) work orders, including photo and signature data.

### Data Storage & Offline-First Design
- **Secure Storage**: Expo SecureStore for JWT tokens and credentials.
- **Local Storage**: React Native AsyncStorage for caching work orders and managing a pending actions queue for offline changes.
- **Offline Login**: Securely stores password hashes for local credential validation when offline, with automatic re-authentication upon reconnect.
- **Synchronization**: Network status monitoring via NetInfo, automatic sync of pending actions when online, and conflict resolution mechanisms.
- **Full Sync**: Pull-to-refresh and sync button trigger full data synchronization, including removal of server-deleted work orders while preserving local pending changes.

### Authentication
- **JWT-Based**: User authenticates against the MeterFlo Server, receiving a JWT token stored securely.
- **Token Management**: Tokens expire after 7 days; `revalidateSession()` refreshes tokens, and `getAuthHeaders()` ensures all API requests include the `Authorization` header.

### Conflict Handling
- **Unified Conflict Check**: `client/lib/conflict-check.ts` provides `checkWorkOrderConflict()` for both online submissions and offline syncs.
- **Detection Logic**: Identifies conflicts if a work order is claimed/completed by another user (case-insensitive username comparison).
- **Resolution**: Alerts users, removes conflicted local data, and prevents submission of outdated information.

### Workflow Wizard
- **Features**: Guides technicians through tasks, including trouble code selection, photo uploads (base64, compressed, e.g., 1200px width, 0.7 quality JPEG), and signature capture (base64 PNG).
- **API Payloads**: Uses camelCase fields for mobile-specific endpoints (e.g., `newSystemId`, `oldSystemReading`).
- **Server-Found Work Orders**: Automatically adds newly completed work orders found via server search to local storage.

### Search Functionality
- **Unified Multi-Field Search**: Supports barcode, QR, HID scanner, and manual entry.
- **Matching**: Searches by system ID (old/new), work order ID (`customerWoId` or internal `id`), and partial service address.
- **Search Order**: Prioritizes local cache, then queries the server if online.
- **Completed Work Orders**: Clearly indicates if a found work order is already completed and prevents further processing.

### Key Design Patterns
- **Path Aliases**: `@/` for `client/` and `@shared/` for `shared/`.
- **Themed Components**: `ThemedText`, `ThemedView` for consistent UI.
- **Error Handling**: `ErrorBoundary` for graceful degradation.
- **Terminology Migration**: "Meter" fields migrated to "System" across the app and API, with backward compatibility and local data migration handled.

## External Dependencies

### Third-Party Services
- **MeterFlo Server**: Primary external API for work order management, with a user-configurable URL.
- **WorkFlow Pro Server**: External API backend for core work order processing, configured during login.

### Key Libraries
- **expo-secure-store**: For encrypted credential storage.
- **@react-native-async-storage/async-storage**: For local data persistence.
- **@react-native-community/netinfo**: For network connectivity monitoring.
- **react-native-gesture-handler**: For touch gesture handling.
- **react-native-reanimated**: For animations.
- **@tanstack/react-query**: For server state management.
- **drizzle-orm**: For database (PostgreSQL) object-relational mapping.

### Database
- **PostgreSQL**: The main database used by the MeterFlo Server backend.
- **Drizzle Kit**: Used for managing database schema migrations.