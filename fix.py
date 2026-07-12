import re
import glob
import os

files = []
for root, _, filenames in os.walk('frontend/src/app'):
    for filename in filenames:
        if filename.endswith('.tsx'):
            files.append(os.path.join(root, filename))

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace ''FILL' 1' with '"FILL" 1' (it gets wrapped in single quotes by the python script already)
    # The current string in the file is `''FILL' 1'`
    # We want it to be `'"FILL" 1'`
    new_content = content.replace("''FILL' 1'", "'\"FILL\" 1'")
    
    if new_content != content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Fixed {file}')
