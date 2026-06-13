// src/errorHandler.ts
/**
 * Global JavaScript exception and unhandled promise rejection interceptor.
 * Logs errors to console.log/console.error so they are printed to stdout/stderr
 * and captured by Android's adb logcat even during early app startup.
 */

// Store the original global handler
// @ts-ignore
const originalHandler = global.ErrorUtils?.getGlobalHandler();

// @ts-ignore
if (global.ErrorUtils) {
  // @ts-ignore
  global.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';

    // Log the error with a recognizable prefix
    console.error(`[GLOBAL ERROR] Fatal: ${isFatal}`);
    console.error(`[GLOBAL ERROR] Message: ${errorMsg}`);
    if (errorStack) {
      console.error(`[GLOBAL ERROR] Stack: ${errorStack}`);
    }

    // Call the original handler to maintain default behavior (like RedBox/LogBox in dev)
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

// Intercept unhandled promise rejections
// @ts-ignore
const originalUnhandledRejection = global.onunhandledrejection;
// @ts-ignore
global.onunhandledrejection = (id: number, error: any) => {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : '';

  console.error(`[UNHANDLED REJECTION] ID: ${id}`);
  console.error(`[UNHANDLED REJECTION] Message: ${errorMsg}`);
  if (errorStack) {
    console.error(`[UNHANDLED REJECTION] Stack: ${errorStack}`);
  }

  if (originalUnhandledRejection) {
    originalUnhandledRejection(id, error);
  }
};

console.log('[ErrorHandler] Registered global exception handlers.');
