"use client";
import { useState, useEffect } from 'react';

const ACCENTS = [
  { id: 'multicolor', label: 'Multicolor', colors: ['#0A84FF', '#5E5CE6', '#30D158', '#64D2FF', '#BF5AF2'] },
  { id: 'emerald', label: 'Emerald', colors: ['#30D158', '#34C759', '#00C7BE', '#32D74B'] },
  { id: 'ocean', label: 'Ocean', colors: ['#0A84FF', '#64D2FF', '#0040DD', '#007AFF'] },
  { id: 'cyberpunk', label: 'Cyberpunk', colors: ['#BF5AF2', '#FF2D55', '#FF375F', '#D30DF2'] },
  { id: 'mono', label: 'Slate', colors: ['#64748B', '#475569', '#334155', '#94A3B8'] }
];

export default function Settings() {
  useEffect(() => {
    let currentIndex = 0;
    
    // Set initial accent
    document.documentElement.setAttribute('data-bg-theme', ACCENTS[0].id);

    // Rotate every 10 seconds
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % ACCENTS.length;
      document.documentElement.setAttribute('data-bg-theme', ACCENTS[currentIndex].id);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return null; // Remove the settings UI completely
}
