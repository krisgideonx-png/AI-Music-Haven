import React from 'react';

interface HavenLogoProps {
  className?: string;
  size?: number;
}

/**
 * Simple, distinctive AI Music Haven emblem:
 * A crisp musical note sheltered inside a welcoming circular arch/haven frame.
 */
export const HavenLogo: React.FC<HavenLogoProps> = ({
  className = '',
  size = 24,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="haven-arch-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="55%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
        <linearGradient id="haven-note-grad" x1="12" y1="10" x2="21" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E4E1E8" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>

      {/* Welcoming Shelter Arch / Open Circular Dome */}
      <path
        d="M5.5 23.5C4.2 21.3 3.5 18.7 3.5 16C3.5 9.1 9.1 3.5 16 3.5C22.9 3.5 28.5 9.1 28.5 16C28.5 18.7 27.8 21.3 26.5 23.5"
        stroke="url(#haven-arch-grad)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Subtle Grounding Threshold */}
      <path
        d="M8.5 26.5H23.5"
        stroke="url(#haven-arch-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Musical Note Sheltered Inside */}
      <path
        d="M17.5 10.5V20.2C17.5 22.0225 15.933 23.5 14 23.5C12.067 23.5 10.5 22.0225 10.5 20.2C10.5 18.3775 12.067 16.9 14 16.9C14.78 16.9 15.5 17.14 16.08 17.55V10.5L22 9V12.2L17.5 13.4"
        stroke="url(#haven-note-grad)"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="20.2" r="2.2" fill="#06B6D4" />
    </svg>
  );
};
