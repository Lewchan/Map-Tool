# Map Tool

虚幻引擎地图生成器，前后端分离架构。

## 架构

- **前端**：`frontend/` - 纯HTML/CSS/JS页面，用于上传图片和查看结果
- **后端**：`backend/` - Python脚本，处理高度图和材质权重图
- **GitHub Actions**：`.github/workflows/process-map.yml` - 自动在GitHub服务器上运行后端

## 使用方法

### 1. 前端使用（本地）
直接打开 `frontend/index.html`，可以：
- 上传高度图（16位PNG）
- 上传材质权重图（0.png~16.png）
- 在本地浏览器中处理（前端模式）

### 2. 后端使用（GitHub Actions）
1. 将高度图放入 `input/height_map/` 文件夹
2. 将材质权重图放入 `input/biome_map/` 文件夹
3. 提交并推送到GitHub
4. GitHub Actions会自动运行，生成的JSON放在 `output/` 文件夹

## 参数配置

- 海平面高度：3550
- 平原坡度阈值：0.30
- 丘陵坡度阈值：0.75
- 采样间隔：2
- 组件宽度：510
- 网格大小：100.0
