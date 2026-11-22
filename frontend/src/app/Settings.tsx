'use client';
import { useState, useEffect } from 'react';

const ACCENTS = [
  { id: 'soft-sky-lavender', label: 'Soft Sky + Lavender', colors: ['#FBFBFB', '#E8F9FF', '#C4D9FF', '#C5BAFF'] },
];

export default function Settings() {
  useEffect(() => {
    let currentIndex = 0;
    
    // Set initial accent
    document.documentElement.setAttribute('data-bg-theme', ACCENTS[0]!.id);

    // Rotate every 10 seconds
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % ACCENTS.length;
      document.documentElement.setAttribute('data-bg-theme', ACCENTS[currentIndex]!.id);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return null; // Remove the settings UI completely
}


