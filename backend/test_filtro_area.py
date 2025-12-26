"""
Script de prueba para el filtro por area_id en el endpoint de facturas.
"""
import urllib.request
import urllib.error
import json

API_URL = "http://localhost:8000/api/v1"

def test_filtro_por_area():
    """Prueba el filtro por area_id."""
    area_id = "4b8fd4c9-9e10-4af4-9a1b-b54c6fe3d5f0"  # Mantenimiento
    
    print("="*60)
    print("🧪 PRUEBAS DE FILTRO POR ÁREA")
    print("="*60)
    
    # 1. Facturas sin filtro
    print("\n1️⃣  Obteniendo todas las facturas (sin filtro)...")
    url = f"{API_URL}/facturas"
    
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(f"✅ Total de facturas: {data['total']}")
            print(f"📄 Facturas en esta página: {len(data['items'])}")
            
            # Mostrar áreas de todas las facturas
            areas = {}
            for factura in data['items']:
                area = factura['area']
                areas[area] = areas.get(area, 0) + 1
            
            print(f"\n📊 Distribución por área:")
            for area, count in areas.items():
                print(f"   - {area}: {count} factura(s)")
    
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # 2. Facturas filtradas por área
    print(f"\n2️⃣  Obteniendo facturas del área Mantenimiento...")
    url_filtered = f"{API_URL}/facturas?area_id={area_id}"
    
    try:
        with urllib.request.urlopen(url_filtered) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(f"✅ Total de facturas en Mantenimiento: {data['total']}")
            print(f"📄 Facturas en esta página: {len(data['items'])}")
            
            if data['items']:
                print(f"\n📋 Detalles de facturas:")
                for factura in data['items'][:5]:  # Mostrar solo las primeras 5
                    print(f"   - {factura['numero_factura']} | {factura['proveedor']} | {factura['area']}")
            else:
                print(f"   ℹ️  No hay facturas en esta área")
    
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # 3. Prueba con área Facturación
    print(f"\n3️⃣  Obteniendo facturas del área Facturación...")
    area_facturacion = "498e9fdb-25f5-42f9-beb8-92564ab6bdf4"
    url_facturacion = f"{API_URL}/facturas?area_id={area_facturacion}"
    
    try:
        with urllib.request.urlopen(url_facturacion) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(f"✅ Total de facturas en Facturación: {data['total']}")
            print(f"📄 Facturas en esta página: {len(data['items'])}")
            
            if data['items']:
                print(f"\n📋 Detalles de facturas:")
                for factura in data['items'][:5]:
                    print(f"   - {factura['numero_factura']} | {factura['proveedor']} | {factura['area']}")
            else:
                print(f"   ℹ️  No hay facturas en esta área")
    
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # 4. Prueba con área inexistente
    print(f"\n4️⃣  Prueba con área inexistente...")
    area_fake = "00000000-0000-0000-0000-000000000000"
    url_fake = f"{API_URL}/facturas?area_id={area_fake}"
    
    try:
        with urllib.request.urlopen(url_fake) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(f"✅ Total de facturas: {data['total']}")
            print(f"   ℹ️  (Esperado: 0 facturas)")
    
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "="*60)
    print("✅ Pruebas completadas")
    print("="*60)


if __name__ == "__main__":
    test_filtro_por_area()
