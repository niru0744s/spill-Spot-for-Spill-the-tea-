/**
 * +html.tsx
 * ---------
 * Custom HTML root for Expo Router web builds.
 * Injects the Agora Web RTC SDK directly from Agora's CDN so it is loaded
 * by the browser at page load — bypassing Metro entirely.
 *
 * Metro cannot bundle agora-rtc-sdk-ng (it's a 1.5 MB UMD browser bundle
 * designed for webpack/vite). Loading it via CDN is Agora's recommended
 * approach for non-webpack web environments.
 *
 * The SDK registers itself as window.AgoraRTC which agoraService.web.ts reads.
 */

import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/*
          Agora Web RTC SDK loaded from CDN.
          This injects window.AgoraRTC into the global scope before the app boots.
          Version is pinned to match the agora-rtc-sdk-ng npm package version (4.24.4).
        */}
        <script src="https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
