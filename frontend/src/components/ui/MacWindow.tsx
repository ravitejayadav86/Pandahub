"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MacWindowProps {
  title: string;
  children: React.ReactNode;
  initialPosition?: { x: number; y: number };
  defaultSize?: { width: number | string; height: number | string };
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
}

export function MacWindow({
  title,
  children,
  initialPosition = { x: 50, y: 50 },
  defaultSize = { width: 500, height: 400 },
  isOpen,
  onClose,
  zIndex = 10,
  onFocus,
}: MacWindowProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Bring to front on click
  const handlePointerDown = () => {
    if (onFocus) onFocus();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {!isMinimized && (
        <motion.div
          ref={windowRef}
          drag={!isMaximized}
          dragMomentum={false}
          dragElastic={0}
          initial={{ opacity: 0, scale: 0.95, ...initialPosition }}
          animate={{
            opacity: 1,
            scale: 1,
            ...(isMaximized
              ? { x: 0, y: 32, width: "100vw", height: "calc(100vh - 110px)" }
              : { width: defaultSize.width, height: defaultSize.height }),
          }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onPointerDown={handlePointerDown}
          style={{ zIndex }}
          className={`absolute flex flex-col overflow-hidden bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] ${
            isMaximized ? "rounded-none" : "rounded-xl"
          }`}
        >
          {/* Header Bar */}
          <div className="relative flex items-center h-10 px-3 bg-white/[0.02] border-b border-white/5 cursor-grab active:cursor-grabbing shrink-0">
            {/* Traffic Lights */}
            <div className="absolute left-3 flex items-center gap-1.5 z-10">
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 border border-red-600/50 flex items-center justify-center group"
              >
                <span className="opacity-0 group-hover:opacity-100 text-[#4d0000] text-[8px] leading-none font-bold">✕</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
                className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 border border-yellow-600/50 flex items-center justify-center group"
              >
                <span className="opacity-0 group-hover:opacity-100 text-[#4d3300] text-[8px] leading-none font-bold">−</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }}
                className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 border border-green-600/50 flex items-center justify-center group"
              >
                <span className="opacity-0 group-hover:opacity-100 text-[#003300] text-[8px] leading-none font-bold">⤢</span>
              </button>
            </div>

            {/* Title */}
            <div className="flex-1 text-center text-xs font-semibold text-white/70 select-none">
              {title}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto bg-transparent relative custom-scrollbar">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
