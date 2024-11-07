// src/components/Logo.tsx
import React from 'react';
import logoImage from '../assets/logo.png';

const Logo: React.FC = () => {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="logo-pattern" patternUnits="userSpaceOnUse" width="40" height="40">
          <image href={logoImage} width="40" height="40" preserveAspectRatio="xMidYMid slice" />
        </pattern>
      </defs>
      <rect width="40" height="40" fill="url(#logo-pattern)" />
    </svg>
  );
};

export default Logo;