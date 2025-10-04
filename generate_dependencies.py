import os
import re

# Pliki, które chcesz sprawdzić
files_to_scan = ["__app.py", "__Pobieracz Zadan.py"]

imports = set()

for file_name in files_to_scan:
    if not os.path.exists(file_name):
        continue
    with open(file_name, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            # Szukamy 'import X' lub 'from X import ...'
            m1 = re.match(r"import (\S+)", line)
            m2 = re.match(r"from (\S+) import", line)
            if m1:
                imports.add(m1.group(1).split(".")[0])
            elif m2:
                imports.add(m2.group(1).split(".")[0])

# Zapis do dependencies.txt
with open("dependencies.txt", "w", encoding="utf-8") as f:
    for module in sorted(imports):
        f.write(f"{module}\n")

print("Gotowe! dependencies.txt wygenerowany.")
