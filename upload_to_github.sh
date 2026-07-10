#!/bin/bash

echo "=========================================="
echo "   Auto-Uploader a GitHub (Optimizador)"
echo "=========================================="

# 1. Pon tu Nombre de Usuario de GitHub aqui:
GITHUB_USERNAME="tu_usuario_aqui"

# 2. Pon tu Token de Acceso Personal (PAT) de GitHub aqui:
GITHUB_TOKEN="tu_token_aqui"

# 3. Si quieres cambiar el mensaje que aparece en GitHub, modificalo aqui:
COMMIT_MSG="Actualizacion automatica del motor y optimizador"

echo ""
echo "[1/3] Empaquetando y subiendo uma-tools..."
cd uma-tools || exit
git add .
git commit -m "$COMMIT_MSG"
git push "https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/alpha123/uma-tools.git" master
cd ..

echo ""
echo "[2/3] Empaquetando y subiendo uma-skill-tools..."
cd uma-skill-tools || exit
git add .
git commit -m "$COMMIT_MSG"
git push "https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/alpha123/uma-skill-tools.git" master
cd ..

echo ""
echo "[3/3] Empaquetando y subiendo optimixer (Carpeta Principal)..."
git add .
git commit -m "$COMMIT_MSG"
git push "https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/Alejandro-Quea/optimixer.git" main

echo ""
echo "=========================================="
echo " ¡Todos los repositorios han sido subidos!"
echo "=========================================="
