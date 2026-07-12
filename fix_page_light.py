import os
import re

filepath = r"c:\Users\ravit\Downloads\Pandahub\frontend\src\app\page.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add framer-motion import
if "import { motion } from 'framer-motion';" not in content:
    content = content.replace("import Link from 'next/link';", "import Link from 'next/link';\nimport { motion } from 'framer-motion';")

# Fix main background
content = content.replace('style={{ background: \'#080a12\' }}', 'style={{ background: \'var(--background)\' }}')

# Fix header background
content = content.replace('style={{ background: \'rgba(8,10,18,0.8)\' }}', 'style={{ background: \'rgba(255,255,255,0.7)\' }}')
content = content.replace('hover:bg-white/5', 'hover:bg-black/5')

# Wrap hero in motion.div
content = content.replace('<section className="relative z-10 flex flex-col items-center justify-center text-center min-h-screen',
    '<motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: "easeOut" }} className="relative z-10 flex flex-col items-center justify-center text-center min-h-screen')
content = content.replace('</section>\n\n      {/* Code Window */}', '</motion.section>\n\n      {/* Code Window */}')

# Wrap code window in motion.div with scroll animation
content = content.replace('<section className="w-full max-w-5xl mx-auto px-6 mb-28 relative z-10 mt-16">',
    '<motion.section initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7 }} className="w-full max-w-5xl mx-auto px-6 mb-28 relative z-10 mt-16">')
content = content.replace('</section>\n\n      {/* Feature Cards */}', '</motion.section>\n\n      {/* Feature Cards */}')

# Fix code window background
content = content.replace('style={{ background: \'rgba(14,18,28,0.8)\' }}', 'style={{ background: \'rgba(240,242,245,0.8)\' }}')
content = content.replace('style={{ background: \'rgba(6,8,16,0.9)\' }}', 'style={{ background: \'rgba(255,255,255,0.9)\' }}')

# Wrap feature cards in motion.div
content = content.replace('<section className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 px-6 mb-28 relative z-10">',
    '<motion.section initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7, staggerChildren: 0.2 }} className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 px-6 mb-28 relative z-10">')
content = content.replace('</section>\n\n      {/* Footer */}', '</motion.section>\n\n      {/* Footer */}')

# Fix footer background
content = content.replace('style={{ background: \'rgba(6,8,16,0.9)\' }}', 'style={{ background: \'rgba(255,255,255,0.9)\' }}')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated page.tsx for Light Mode & Framer Motion")
