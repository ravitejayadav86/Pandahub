import os

src_dir = r"c:\Users\ravit\Downloads\Pandahub\frontend\src"

for root, _, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.jsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            # Fix ''FILL' 1' -> '"FILL" 1'
            new_content = new_content.replace("fontVariationSettings: ''FILL' 1'", "fontVariationSettings: '\"FILL\" 1'")
            # Fix ''FILL' 0' -> '"FILL" 0'
            new_content = new_content.replace("fontVariationSettings: ''FILL' 0'", "fontVariationSettings: '\"FILL\" 0'")
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Fixed {filepath}")
            
print("Done.")
