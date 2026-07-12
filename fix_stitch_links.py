import os

src_dir = r"c:\Users\ravit\Downloads\Pandahub\frontend\src\stitch"

for file in os.listdir(src_dir):
    if file.endswith('.tsx'):
        filepath = os.path.join(src_dir, file)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        content = content.replace('href="#"', 'href="/explore"')
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

print("Replaced dummy links in stitch components")
