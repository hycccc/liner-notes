# 版本管理规范

## 版本号格式：主版本.次版本.补丁 (e.g. 3.5.2)

| 场景 | 变化 | 例子 |
|------|------|------|
| Bug 修复、小调整 | +0.0.1（补丁） | 3.5.1 → **3.5.2** |
| 新功能、明显改进 | +0.1（次版本，补丁归零） | 3.5.2 → **3.6.0** |
| 架构重构、大版本 | +1（主版本，其余归零） | 3.6.0 → **4.0.0** |

## 每次必须同步修改两处
1. `package.json` → `"version"` 字段
2. `components/HomeClient.tsx` → 导航栏的 `v3.x.x · ...` 标签

## 发布流程
```
npm run build        # 验证
git add -A
git commit -m "v3.x.x: 改动说明"
git push
# VPS: git pull && pm2 restart liner-notes
```
