#!/usr/bin/env bash
set -e

ZIP_NAME="HDP_BILLAR_WINDOWS.zip"

echo "📦 Creando paquete limpio: $ZIP_NAME..."

# Eliminar zip anterior si existe
rm -f "$ZIP_NAME"

# Si existe el comando zip en Linux, usarlo con exclusiones
if command -v zip >/dev/null 2>&1; then
    zip -r -q "$ZIP_NAME" . \
        -x "node_modules/*" \
        -x "runtime/*" \
        -x ".git/*" \
        -x "billiard-app-windows/*" \
        -x "public/renders/*" \
        -x "public/temp_uploads/*" \
        -x "public/proyectos_billar/*" \
        -x "projects/*" \
        -x "install.log" \
        -x "preview.sh" \
        -x "crear_zip.sh" \
        -x "repomix-output.xml" \
        -x "*.zip" \
        -x "0"
else
    # Respaldo universal con Python 3 si zip no está instalado
    python3 -c "
import os, zipfile

zip_name = '$ZIP_NAME'
exclude_dirs = {
    'node_modules', 'runtime', '.git', 'billiard-app-windows',
    'projects'
}
exclude_subdirs = {
    os.path.join('public', 'renders'),
    os.path.join('public', 'temp_uploads'),
    os.path.join('public', 'proyectos_billar')
}
exclude_files = {
    'install.log', 'preview.sh', 'crear_zip.sh', 'repomix-output.xml',
    zip_name, '0'
}

with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        rel_root = os.path.relpath(root, '.')
        top_dir = rel_root.split(os.sep)[0]
        
        if top_dir in exclude_dirs:
            continue
        if any(rel_root.startswith(sd) for sd in exclude_subdirs):
            continue

        for f in files:
            if f.endswith('.zip') or f in exclude_files:
                continue
            full_path = os.path.join(root, f)
            arcname = os.path.relpath(full_path, '.')
            zipf.write(full_path, arcname)
"
fi

FILE_SIZE=$(ls -lh "$ZIP_NAME" | awk '{print $5}')
echo ""
echo "=========================================================="
echo "  ✔ ARCHIVO GENERADO CON ÉXITO: $ZIP_NAME"
echo "  📦 Tamaño final: $FILE_SIZE (Ultra liviano)"
echo "=========================================================="
echo "Ya puedes enviarle este .zip a cualquier persona con Windows."
