/**
 * modules.d.ts
 * ------------
 * Type declarations for firebase submodules that TypeScript fails to resolve
 * when using Expo's bundler moduleResolution with the react-native custom condition.
 *
 * Firebase's package.json exports map has a top-level "types" field but no
 * "react-native" or "types" condition nested under it, causing TypeScript to
 * fall through to the "default" (browser ESM .js) entry without a .d.ts.
 *
 * These declarations re-export from the known .d.ts files directly.
 */

declare module "firebase/firestore" {
  export * from "@firebase/firestore";
}

declare module "firebase/storage" {
  export * from "@firebase/storage";
}

declare module "firebase/data-connect" {
  export * from "@firebase/data-connect";
}

declare module "firebase/auth" {
  export * from "@firebase/auth";
  // getReactNativePersistence is part of the RN build — present at runtime via Metro
  import type { ReactNativeAsyncStorage, Persistence } from "@firebase/auth";
  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage
  ): Persistence;
}
