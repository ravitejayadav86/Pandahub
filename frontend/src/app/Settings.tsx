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
  const [isOpen, setIsOpen] = useState(false);
  const [activeAccent, setActiveAccent] = useState('multicolor');

  useEffect(() => {
    // Determine initial accent
    const accent = localStorage.getItem('bg-theme') || 'multicolor';
    setActiveAccent(accent);
    document.documentElement.setAttribute('data-bg-theme', accent);
  }, []);

  const selectAccent = (id: string) => {
    setActiveAccent(id);
    document.documentElement.setAttribute('data-bg-theme', id);
    localStorage.setItem('bg-theme', id);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-full flex items-center justify-center glass-panel border border-primary/20 hover:scale-110 active:scale-95 transition-all shadow-lg hover:shadow-primary/10 text-on-surface"
      >
        <span className="material-symbols-outlined text-xl animate-spin-slow">settings</span>
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-72 rounded-2xl glass-panel p-5 shadow-2xl border border-border-color animate-fade-in-up">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-bold tracking-tight text-on-surface">Preferences</h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-on-surface-variant hover:text-on-surface text-sm"
            >
              Close
            </button>
          </div>

          <div className="space-y-4">
            {/* Accent Selection */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-on-surface-variant block">Background Colors</span>
              <div className="grid grid-cols-2 gap-2">
                {ACCENTS.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => selectAccent(acc.id)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                      activeAccent === acc.id 
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border-color hover:bg-black/5 text-on-surface-variant'
                    }`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrolling Speed Info */}
            <div className="pt-2 border-t border-white/5 space-y-1">
              <div className="flex justify-between text-xs text-outline">
                <span>Canvas Particles</span>
                <span className="font-semibold text-primary">Smooth Motion</span>
              </div>
              <div className="flex justify-between text-xs text-outline">
                <span>Animations</span>
                <span className="font-semibold text-primary">Interactive Parallax</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
