import re
import os
import glob

def html_to_jsx(html):
    # Extract body
    body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL | re.IGNORECASE)
    if not body_match:
        return ""
    content = body_match.group(1)
    
    # Remove comments
    content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)
    
    # class to className
    content = content.replace('class="', 'className="')
    content = content.replace('for="', 'htmlFor="')
    
    # Fix self-closing tags
    for tag in ['input', 'img', 'br', 'hr']:
        content = re.sub(rf'<{tag}([^>]*?)(?<!/)>', rf'<{tag}\1 />', content, flags=re.IGNORECASE)
        
    # Fix style attributes
    def style_replacer(match):
        style_str = match.group(1)
        styles = []
        for prop in style_str.split(';'):
            if not prop.strip(): continue
            k, v = prop.split(':', 1)
            k = k.strip()
            # camelCase
            k = re.sub(r'-([a-z])', lambda m: m.group(1).upper(), k)
            v = v.strip().replace('"', '\\"')
            styles.append(f"{k}: '{v}'")
        return 'style={{' + ', '.join(styles) + '}}'
    content = re.sub(r'style="([^"]*)"', style_replacer, content)
    
    return "export default function GeneratedPage() {\n  return (\n    <main className=\"min-h-screen text-on-surface bg-background font-body\">\n" + content + "\n    </main>\n  );\n}"

os.makedirs('frontend/src/stitch', exist_ok=True)

for file in glob.glob('.stitch_screens/*.html'):
    name = os.path.basename(file).replace('.html', '.tsx')
    with open(file, 'r', encoding='utf-8') as f:
        html = f.read()
    jsx = html_to_jsx(html)
    with open(f'frontend/src/stitch/{name}', 'w', encoding='utf-8') as f:
        f.write(jsx)
    print(f"Converted {name}")
