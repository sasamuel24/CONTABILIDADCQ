"""Buscar líneas con caracteres problemáticos"""
import os

script_dir = os.path.dirname(__file__)
file_path = os.path.join(script_dir, 'Cuentax.txt')

with open(file_path, 'rb') as f:
    lines = f.readlines()

bad_chars = [b'\x8d', b'\x8f', b'\x90', b'\x9d', b'\x81', b'\x8e', b'\x9e', b'\x9f']

for i, line in enumerate(lines, 1):
    for bad in bad_chars:
        if bad in line:
            print(f"Línea {i}: {line[:100]}")
            print(f"  -> Contiene byte: {bad.hex()}")
            # Mostrar el texto decodificado como latin-1
            try:
                text = line.decode('latin-1').strip()
                print(f"  -> Texto: {text[:80]}")
            except:
                pass
            print()
