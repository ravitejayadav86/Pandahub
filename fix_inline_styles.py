import os

def fix_styles(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Generic background fixes
    content = content.replace("background: 'var(--bg-primary)'", "background: 'var(--background)'")
    content = content.replace("background: 'var(--bg-secondary)'", "background: 'var(--surface)'")
    content = content.replace("background: 'var(--bg-tertiary)'", "background: 'var(--surface-variant)'")
    
    # Dashboard specific fixes
    content = content.replace('bg-surface/60', 'bg-surface/90')
    content = content.replace('bg-surface/40', 'bg-surface/90')
    content = content.replace('text-outline-variant', 'text-on-surface-variant')
    
    # Remove dark hardcoded hexes
    content = content.replace('#080a12', 'var(--background)')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

pages = [
    r"c:\Users\ravit\Downloads\Pandahub\frontend\src\app\explore\page.tsx",
    r"c:\Users\ravit\Downloads\Pandahub\frontend\src\app\dashboard\page.tsx",
    r"c:\Users\ravit\Downloads\Pandahub\frontend\src\app\(dashboard)\DashboardNav.tsx"
]

for p in pages:
    fix_styles(p)

print("Updated inline styles for light mode")
