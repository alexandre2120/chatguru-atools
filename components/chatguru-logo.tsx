import React from 'react';

interface ChatGuruLogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function ChatGuruLogo({ className = "", iconOnly = false }: ChatGuruLogoProps) {
  if (iconOnly) {
    return (
      <svg
        viewBox="0 0 60 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <rect width="60" height="60" rx="12" fill="#0D5D56" />
        <text
          x="30"
          y="40"
          fontSize="28"
          fontWeight="bold"
          fill="white"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          cg
        </text>
      </svg>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-8 w-8"
      >
        <rect width="40" height="40" rx="8" fill="#0D5D56" />
        <text
          x="20"
          y="27"
          fontSize="18"
          fontWeight="bold"
          fill="white"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          cg
        </text>
      </svg>
      <span className="text-2xl font-bold text-primary">chatguru</span>
    </div>
  );
}
