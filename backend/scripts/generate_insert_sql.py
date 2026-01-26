"""
Script para generar SQL de inserción desde el archivo Cuentax.txt
Ejecutar: python scripts/generate_insert_sql.py
"""
import os
import unicodedata

def clean_text(text):
    """Eliminar caracteres problemáticos WIN1252 y normalizar"""
    # Reemplazar caracteres de control problemáticos
    replacements = {
        '\x8d': '',  '\x8f': '',  '\x90': '',  '\x9d': '',
        '\x81': '',  '\x8e': '',  '\x9e': '',  '\x9f': '',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    
    # Normalizar unicode
    text = unicodedata.normalize('NFKC', text)
    return text

script_dir = os.path.dirname(__file__)
file_path = os.path.join(script_dir, 'Cuentax.txt')
output_path = os.path.join(script_dir, 'insert_cuentas.sql')

# Intentar diferentes encodings
encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
lines = None

for encoding in encodings:
    try:
        with open(file_path, 'r', encoding=encoding) as f:
            lines = f.readlines()
            print(f"✅ Archivo leído con encoding: {encoding}")
            break
    except UnicodeDecodeError:
        continue

if lines is None:
    print("❌ Error: No se pudo leer el archivo")
    exit(1)

cuentas_data = []

# Saltar la primera línea (encabezado)
for line in lines[1:]:
    line = line.strip()
    if not line:
        continue
    
    # Separar por tabulador
    parts = line.split('\t')
    if len(parts) >= 2:
        codigo = parts[0].strip()
        descripcion = clean_text(parts[1].strip())
        # Escapar comillas simples
        descripcion = descripcion.replace("'", "''")
        cuentas_data.append((codigo, descripcion))

print(f"Total de cuentas: {len(cuentas_data)}")

# Generar INSERT en lotes de 50
with open(output_path, 'w', encoding='utf-8') as out:
    out.write("-- Script de inserción de Cuentas Auxiliares\n")
    out.write("-- Generado automáticamente desde Cuentax.txt\n")
    out.write(f"-- Total de cuentas: {len(cuentas_data)}\n")
    out.write("\n")
    
    batch_size = 50
    for i in range(0, len(cuentas_data), batch_size):
        batch = cuentas_data[i:i+batch_size]
        
        out.write("INSERT INTO cuentas_auxiliares (id, codigo, descripcion, activa, created_at, updated_at)\n")
        out.write("VALUES\n")
        
        values = []
        for codigo, descripcion in batch:
            values.append(f"    (gen_random_uuid(), '{codigo}', '{descripcion}', true, NOW(), NOW())")
        
        out.write(",\n".join(values))
        out.write("\nON CONFLICT (codigo) DO NOTHING;\n")
        out.write("\n")

print(f"✅ Archivo SQL generado: {output_path}")
