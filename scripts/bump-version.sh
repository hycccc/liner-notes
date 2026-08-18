#!/bin/bash
# 版本自动同步工具
# 使用方式:
#   ./scripts/bump-version.sh patch  # +0.0.1 (bug修复)
#   ./scripts/bump-version.sh minor  # +0.1.0 (新功能)
#   ./scripts/bump-version.sh major  # +1.0.0 (大版本)

set -e

cd "$(dirname "$0")/.."

if [ $# -ne 1 ]; then
  echo "用法: $0 {patch|minor|major}"
  exit 1
fi

TYPE=$1

# 获取当前版本
CURRENT_VERSION=$(grep '"version":' package.json | sed -E 's/.*"version": "([^"]+)".*/\1/')
echo "当前版本: $CURRENT_VERSION"

# 解析版本号
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# 计算新版本
case $TYPE in
  patch)
    PATCH=$((PATCH + 1))
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  *)
    echo "无效的类型: $TYPE (应为 patch|minor|major)"
    exit 1
    ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "新版本:   $NEW_VERSION"

# 更新 package.json
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
echo "✅ package.json 已更新"

# 更新 HomeClient.tsx
sed -i "s/VERSION = \"$CURRENT_VERSION\"/VERSION = \"$NEW_VERSION\"/" components/HomeClient.tsx
echo "✅ HomeClient.tsx 已更新"

echo ""
echo "🎉 版本已同步到 $NEW_VERSION"
echo "下一步: git add package.json components/HomeClient.tsx && git commit -m \"bump: v$NEW_VERSION\""
