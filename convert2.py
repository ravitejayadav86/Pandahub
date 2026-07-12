import re
import os
import glob

def html_to_jsx(html):
    # Extract body
    body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL | re.IGNORECASE)
    if not body_match: return ""
    content = body_match.group(1)
    
    # Remove comments and scripts
    content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)
    content = re.sub(r'<script.*?>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
    
    # Escape raw braces so JSX doesn't interpret them as expressions
    content = content.replace('{', '&#123;')
    content = content.replace('}', '&#125;')
    
    # className, htmlFor, etc
    content = content.replace('class="', 'className="')
    content = content.replace('for="', 'htmlFor="')
    content = content.replace('onclick="', 'onClick={() => {}} data-onclick="')
    content = content.replace('oninput="', 'onChange={() => {}} data-oninput="')
    content = content.replace('onsubmit="', 'onSubmit={(e) => e.preventDefault()} data-onsubmit="')
    content = content.replace('tabindex="', 'tabIndex="')
    content = content.replace('stroke-width="', 'strokeWidth="')
    content = content.replace('stroke-linecap="', 'strokeLinecap="')
    content = content.replace('stroke-linejoin="', 'strokeLinejoin="')
    content = content.replace('clip-rule="', 'clipRule="')
    content = content.replace('fill-rule="', 'fillRule="')
    content = content.replace('viewbox="', 'viewBox="')
    
    # Fix self-closing tags
    for tag in ['input', 'img', 'br', 'hr', 'link', 'meta']:
        content = re.sub(rf'<{tag}([^>]*?)(?<!/)>', rf'<{tag}\1 />', content, flags=re.IGNORECASE)

    # Fix style attributes
    def style_replacer(match):
        style_str = match.group(1)
        styles = []
        for prop in style_str.split(';'):
            if not prop.strip(): continue
            k, v = prop.split(':', 1)
            k = k.strip()
            k = re.sub(r'-([a-z])', lambda m: m.group(1).upper(), k)
            v = v.strip().replace('"', '\\"')
            styles.append(f"{k}: '{v}'")
        return 'style={{' + ', '.join(styles) + '}}'
    content = re.sub(r'style="([^"]*)"', style_replacer, content)
    
    # Quick fix for unmatched tags - wrap everything in a single element
    return '"use client";\n\nexport default function GeneratedPage() {\n  return (\n    <main className="min-h-screen text-on-surface bg-background font-body">\n' + content + '\n    </main>\n  );\n}'

os.makedirs('frontend/src/stitch', exist_ok=True)
for file in glob.glob('.stitch_screens/*.html'):
    name = os.path.basename(file).replace('.html', '.tsx')
    with open(file, 'r', encoding='utf-8') as f:
        html = f.read()
    jsx = html_to_jsx(html)
    with open(f'frontend/src/stitch/{name}', 'w', encoding='utf-8') as f:
        f.write(jsx)
