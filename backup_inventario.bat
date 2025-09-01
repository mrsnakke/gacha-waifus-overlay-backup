@echo off
echo Realizando backup del inventario...

REM Navegar al directorio del script (y por lo tanto del repo)
cd /d "%~dp0"

REM Anadir el archivo de inventario al staging area
git add "GachaWish/user_inventory.json"

REM Comprobar si hay cambios para commitear. Si no hay cambios, el script termina.
git diff --staged --quiet
IF NOT ERRORLEVEL 1 (
    echo "No se encontraron cambios en el inventario. No se requiere backup."
    goto:eof
)

echo "Detectados cambios en el inventario. Subiendo a GitHub..."
REM Crear un commit con la fecha y hora actual
git commit -m "Backup automatico de inventario: %date% %time%"

REM Subir los cambios a GitHub
git push origin main

echo "Backup completado exitosamente."
echo.
