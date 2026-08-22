/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface AppLogoProps {
  /** Rendered size in px. */
  size?: number;
  className?: string;
}

/**
 * The Senior SafeSpot mark: the same SG target used as the installed app icon
 * in public/manifest.json. Kept in sync with that file so the icon a senior
 * taps on their home screen is the one they see inside the app.
 */
export const AppLogo: React.FC<AppLogoProps> = ({ size = 40, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    role="img"
    aria-label="SafeSpot.SG"
    className={`shrink-0 rounded-[22%] ${className}`}
  >
    <rect width="100" height="100" rx="22" fill="#0b0b0d" />
    <circle cx="50" cy="50" r="38" fill="#e11d48" />
    <circle cx="50" cy="50" r="29" fill="#ffffff" />
    <circle cx="50" cy="50" r="16" fill="#e11d48" />
    <text
      x="50"
      y="56"
      fontSize="15"
      textAnchor="middle"
      fill="#ffffff"
      fontFamily="system-ui, -apple-system, sans-serif"
      fontWeight="bold"
    >
      SG
    </text>
  </svg>
);
