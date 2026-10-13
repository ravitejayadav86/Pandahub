"use client";

import React, { useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import {
  Folder,
  Terminal,
  Compass,
  Image as ImageIcon,
  MessageCircle,
  Settings,
} from "lucide-react";

export interface DockItem {
  name: string;
  icon: any;
}

export function FloatingDock({ items, onItemClick }: { items?: DockItem[], onItemClick?: (name: string) => void }) {
  const mouseX = useMotionValue(Infinity);

  const defaultItems = [
    { name: "Finder", icon: Folder },
    { name: "Terminal", icon: Terminal },
    { name: "Safari", icon: Compass },
    { name: "Gallery", icon: ImageIcon },
    { name: "Messages", icon: MessageCircle },
    { name: "Settings", icon: Settings },
  ];

  const dockItems = items || defaultItems;

  return (
    <div
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-end gap-2 px-3 py-3 rounded-3xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] z-50 h-20"
    >
      {dockItems.map((item, index) => (
        <DockIcon key={index} name={item.name} mouseX={mouseX} onClick={() => onItemClick?.(item.name)}>
          <item.icon className="w-full h-full text-white/80" />
        </DockIcon>
      ))}
    </div>
  );
}

function DockIcon({
  mouseX,
  name,
  children,
  onClick,
}: {
  mouseX: any;
  name: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  // Calculate distance from mouse to center of this icon
  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  // Scale the size based on distance
  const widthTransform = useTransform(distance, [-150, 0, 150], [48, 80, 48]);
  const heightTransform = useTransform(distance, [-150, 0, 150], [48, 80, 48]);

  // Apply spring physics for buttery smooth magnification
  const width = useSpring(widthTransform, {
    mass: 0.1,
    stiffness: 250,
    damping: 15,
  });

  const height = useSpring(heightTransform, {
    mass: 0.1,
    stiffness: 250,
    damping: 15,
  });

  return (
    <div className="relative flex flex-col items-center justify-end h-full">
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 5, x: "-50%" }}
            transition={{ duration: 0.15 }}
            className="absolute -top-14 left-1/2 whitespace-nowrap px-3 py-1.5 rounded-md bg-[#1a1a1a] border border-white/10 text-gray-200 text-xs font-medium shadow-xl pointer-events-none z-50"
          >
            {name}
            {/* Tooltip triangle */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1a1a1a] border-b border-r border-white/10 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        ref={ref}
        style={{ width, height }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onClick}
        className="flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10 cursor-pointer relative shadow-inner overflow-hidden transform-gpu"
      >
        <div className="w-1/2 h-1/2 flex items-center justify-center">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
