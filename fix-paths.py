import os
import re

dist_dir = r'c:\Users\super\Desktop\APKFITNESS\TitoFitApp_v2\dist'

# Buscar todos los archivos HTML
for root, dirs, files in os.walk(dist_dir):
    for file in files:
        if file.endswith('.html'):
            filepath = os.path.join(root, file)
            
            # Leer el archivo
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Reemplazar las rutas
            content = content.replace('src="/_expo/', 'src="/app/_expo/')
            content = content.replace('href="/_expo/', 'href="/app/_expo/')
            content = content.replace('href="/favicon', 'href="/app/favicon')
            
            # Guardar el archivo
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f'Actualizado: {file}')

print('\n✅ Todos los archivos HTML han sido actualizados con el prefijo /app/')
