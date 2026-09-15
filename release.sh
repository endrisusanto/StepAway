#!/usr/bin/env bash
# StepAway - Release Helper Script
# ponytail: clean, standard bash script to stage, commit, and push changes to trigger GitHub Action release.

set -e

# Pastikan berada di root direktori project
cd "$(dirname "$0")"

# Ambil pesan commit dari argumen atau default
COMMIT_MSG="$*"
if [ -z "$COMMIT_MSG" ]; then
  COMMIT_MSG="chore: update StepAway project files and triggers release"
fi

echo "🚀 [StepAway Release] Menyiapkan rilis..."

# Pastikan remote origin terpasang ke repo yang benar
git remote set-url origin https://github.com/endrisusanto/StepAway.git 2>/dev/null || git remote add origin https://github.com/endrisusanto/StepAway.git

# Set branch utama ke main
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
if [ "$CURRENT_BRANCH" != "main" ]; then
  git branch -M main
fi

# Stage semua perubahan
git add .

# Cek apakah ada perubahan untuk dicommit
if git diff --cached --quiet; then
  echo "ℹ️  Tidak ada perubahan file baru untuk dicommit."
else
  echo "📦 Melakukan commit: '$COMMIT_MSG'"
  git commit -m "$COMMIT_MSG"
fi

# Tarik commit otomatis terbaru dari GitHub Actions bot jika ada
echo "🔄 Menyelaraskan dengan remote origin (rebase)..."
git pull --rebase origin main

# Push ke origin main
echo "⬆️  Mendorong commit ke GitHub (origin main)..."
git push -u origin main

echo "✅ Berhasil didorong ke https://github.com/endrisusanto/StepAway !"
echo "⚡ GitHub Action akan otomatis meng-compile Android APK, membuat version tag baru, changelog, dan release."
