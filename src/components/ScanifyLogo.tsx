import React from 'react';

export const ScanifyLogo: React.FC<{ className?: string }> = ({ className = 'h-8 w-8' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="scanifyLogoGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#8B5CF6" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="16" fill="#0B1224" />
    <path
      d="M16 23V18C16 16.8954 16.8954 16 18 16H23"
      stroke="url(#scanifyLogoGrad)"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    <path
      d="M41 16H46C47.1046 16 48 16.8954 48 18V23"
      stroke="url(#scanifyLogoGrad)"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    <path
      d="M16 41V46C16 47.1046 16.8954 48 18 48H23"
      stroke="url(#scanifyLogoGrad)"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    <path
      d="M41 48H46C47.1046 48 48 47.1046 48 46V41"
      stroke="url(#scanifyLogoGrad)"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    <rect x="23" y="22" width="18" height="20" rx="3" fill="#172546" stroke="#60A5FA" strokeWidth="1.6" />
    <rect x="26.5" y="26" width="5.5" height="5.5" rx="1" fill="#3B82F6" />
    <rect x="34" y="26.5" width="3.5" height="1.8" rx="0.9" fill="#93C5FD" />
    <rect x="34" y="29.5" width="3.5" height="1.8" rx="0.9" fill="#93C5FD" />
    <rect x="26.5" y="34" width="11" height="1.8" rx="0.9" fill="#A78BFA" />
    <rect x="26.5" y="37.2" width="7.5" height="1.8" rx="0.9" fill="#60A5FA" />
  </svg>
);
