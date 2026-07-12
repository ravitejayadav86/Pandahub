import os

filepath = r"c:\Users\ravit\Downloads\Pandahub\frontend\src\app\dashboard\page.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Make the NextJS imports available
if "import Link from 'next/link';" not in content:
    content = content.replace('"use client";', '"use client";\nimport Link from \'next/link\';')

# Replace specific links
content = content.replace('href="#"', 'href="/explore"')

# Replace 'a' with 'Link' for better navigation (this is a bit rough but works for this specific mockup)
# Actually, just leaving it as <a href="/explore"> is fine for a mockup and less risky than regexing <a to <Link.

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Replaced dummy links in dashboard/page.tsx")
