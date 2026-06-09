# Spill ☕ — Premium Realtime Chat App

Welcome to **Spill**! Spill is a premium, real-time, local-first 1:1 chat application built on Expo (React Native) and Firebase. 

Designed with a sleek, vibrant aesthetic featuring dynamic ambient orb animations, high-contrast matcha green accents (`#96f996`), and a premium dark mode, Spill offers a gorgeous, state-of-the-art interactive messaging experience.

---

## 🏗️ Architectural Core

Spill is designed with a **Local-First, Cloud-Synced** philosophy. It provides instant load times and immediate UI feedback by treating local storage as the source of truth, syncing changes asynchronously to the Cloud Firestore database when network conditions allow.

```
                  ┌──────────────────────┐
                  │      React UI        │
                  └──────────┬───────────┘
              (Synchronous)  │   ▲ (Reactive State)
                             ▼   │
                  ┌──────────────────────┐
                  │    MMKV Storage      │
                  └──────────┬───────────┘
              (Asynchronous) │   ▲ (onSnapshot Listeners)
                             ▼   │
                  ┌──────────────────────┐
                  │   Cloud Firestore    │
                  └──────────┬───────────┘
                             ▼ (Push API)
                  ┌──────────────────────┐
                  │  Expo Push Service  │
                  └──────────────────────┘
```

### 1. High-Performance Local-First Store (`react-native-mmkv`)
Instead of using slow asynchronous storage solutions (like AsyncStorage), Spill uses **MMKV**. MMKV is a high-speed, synchronous key-value store backed by memory-mapped files, offering read and write operations in under 1ms.
- **Messages Cache**: Local rooms hold the last 200 messages in MMKV for instant viewport rendering upon room opening.
- **Draft Persistence**: Unsent message drafts are captured automatically per chat and persist across sessions.
- **Synchronous Badging**: Unread message counts are computed synchronously.

### 2. Ephemeral Real-Time Triggers
- **Presence**: User online/offline statuses are monitored in real time using active sessions.
- **Typing Indicators**: Ephemeral documents are generated in Firestore under a 3-second Time-To-Live (TTL) to simulate real-time typing indicators (`typing...`) with minimal database footprint.

### 3. Outgoing Message Call Stack (Optimistic UI)
```
User hits "Send"
  │
  ├─► Generates local UUID via `expo-crypto` & gets Unix Millisecond timestamp
  ├─► Appends message object to MMKV with status = "SENDING" (UI updates instantly)
  │
  ├─► Initiates background Firestore promise:
  │     │
  │     ├─► Writes message document to `/chats/{chatId}/messages/{id}`
  │     ├─► Merges preview text into `/chats/{chatId}` metadata
  │     ├─► Writes activity alert & increments unread counter in partner's inbox `/users/{partnerUid}/inbox/{chatId}`
  │     │
  │     ├─► SUCCESS: Flips status to "SENT" (Ticks update to single check ✓)
  │     │
  │     └─► FAILURE: Flips status to "FAILED", enqueues to MMKV `retry_queue`
  │
  └─► Triggers background Push Notification via HTTPS POST to Expo Push API Gateway
```

### 4. Background Delivery & Global Synchronizer (`useGlobalMessages`)
Even when the chat screen is not active, Spill maintains a single app-level global synchronization listener inside `_layout.tsx`:
- **Inbox Watch**: Subscribes to `/users/{currentUid}/inbox`.
- **Background Downloader**: The moment a partner sends a message, our global listener detects it, pulls down the new messages, writes them instantly to MMKV local cache, and increments the unread badge.
- **Immediate Ticks Delivery**: If the app is active (even if on a different screen), it automatically writes the `DELIVERED` status back to the message document in Firestore, letting the sender see double gray ticks (`✓✓`) in real time.

### 5. Dual-Layer Keyboard Resizing
- **Android**: Configured `"softwareKeyboardLayoutMode": "resize"` in `app.json`. The Android OS automatically resizes the window viewport when the keyboard slides up, keeping the chat input bar perfectly docked above the keyboard.
- **iOS**: Uses a customized `KeyboardAvoidingView` set to `behavior="padding"` with an offset corresponding to the safe-area header.

### 6. Push Notifications & Deep Link Routing
- **Expo Notifications**: Features standard integration with `expo-notifications`. Registers device push tokens and writes them directly to `/users/{uid}/pushToken`.
- **FCM V1 Integration**: Delivers mobile alerts directly when users background or completely close the application.
- **Tap Deep Routing**: Includes a layout listener (`addNotificationResponseReceivedListener`) that catches notification interactions and performs immediate router deep-linking directly to `/chat/[id]`.
- **Safety Pre-Checks**: Gracefully bypasses native FCM operations on Android emulators or setups missing a `google-services.json` file, outputting clean guides in the console instead of throwing native application errors.

---

## 📂 Project Directory Structure

```
spill/
├── app.json                     # Expo configurations & metadata (including EAS projectId)
├── package.json                 # Dependency manifests
├── src/
│   ├── app/                     # File-based App Router screens
│   │   ├── (auth)/              # Authentication screens (login, signup)
│   │   ├── (tabs)/              # Core bottom navigation tabs
│   │   │   ├── chats.tsx        # Dashboard ("What's Brewin'")
│   │   │   ├── explore.tsx      # Explore circles (Placeholder)
│   │   │   ├── community.tsx    # Groups (Placeholder)
│   │   │   └── profile.tsx      # Profile options & sign-out
│   │   ├── chat/[id].tsx        # Real-time interactive 1:1 chat room
│   │   ├── search.tsx           # Search users & initiate conversations
│   │   └── _layout.tsx          # Session, Push & Global Sync orchestrator
│   │
│   ├── components/              # Highly reusable visual UI elements
│   ├── config/
│   │   └── firebase.ts          # Singleton modular Firebase SDK initialization
│   │
│   ├── hooks/
│   │   ├── useAuth.ts           # Authentication operations & Zustand-sync hook
│   │   ├── useGlobalMessages.ts # Background inbox synchronization engine
│   │   ├── useInbox.ts          # Synchronous MMKV read hook for dashboard preview
│   │   ├── useRealtimeChat.ts   # Chat room Firestore sync, typing & connection hook
│   │   └── useSearch.ts         # Case-insensitive debounced prefix-match hook
│   │
│   ├── services/
│   │   ├── activeChat.ts        # Focused room tracking singleton
│   │   ├── chatStorage.ts       # MMKV local storage schemas & actions
│   │   ├── messageService.ts    # Sending, tick syncing & push trigger logic
│   │   ├── mmkv.ts              # MMKV local storage instantiation
│   │   └── notificationService.ts # Device token registrations & Expo dispatchers
│   │
│   └── store/
│       └── authStore.ts         # Zustand global authentication state store
```

---

## ⚙️ Setup & Installation

Follow these steps to run Spill locally:

### 1. Pre-requisites
- **NodeJS** (v18 or higher recommended)
- **EAS CLI** (`npm i -g eas-cli`)
- A physical device running **Expo Go** or a configured simulator environment.

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configurations
Create a `.env` file in the root of the project with your Firebase Web App credentials:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 4. Android Push Credentials (Optional but Recommended)
To run push notifications on Android:
1. Download **`google-services.json`** from your Firebase Console.
2. Put the file in the root directory.
3. Reference the file in your `app.json` inside the `android` block:
   ```json
   "android": {
     "googleServicesFile": "./google-services.json"
   }
   ```

### 5. Running the Developer Build
```bash
# Start Metro bundler
npm run start

# Run on Android Build
npm run android

# Run on iOS Build
npm run ios
```

---

## ☕ What is Completed & Ready

*   [x] **Authentication Flow**: Enriched profile creation on signup, offline persistence, and automatic session restoration.
*   [x] **User Search**: Debounced, case-insensitive user profile prefix-range searches.
*   [x] **Chat List**: Real-time card previews, synchronous unread counts, online status bubbles, and animated list transitions.
*   [x] **Local Cache Storage**: Complete MMKV architecture, draft preservation, and offline sending queues.
*   [x] **Typing Indicators**: Real-time, lightweight 3s TTL typing animations.
*   [x] **Keyboard Avoidance**: Resizing layout modes that perfectly position the input field above the keyboard on both Android and iOS.
*   [x] **Delivery Ticks System**: Instant SENT (`✓`), DELIVERED (`✓✓` gray), and READ (`✓✓` matcha green) statuses.
*   [x] **Push Notification Infrastructure**: Fully functional token registration, Firestore mapping, background notifications delivery, and notification tap response router deep-linking.
