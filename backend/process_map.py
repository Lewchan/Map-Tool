#!/usr/bin/env python3
import os
import json
from PIL import Image
import numpy as np

# 地形枚举
E_Terrain = {
    "Plain": 0,
    "Hill": 1,
    "Water": 2,
    "Mountain": 3,
    "Build": 4,
    "Road": 5,
    "Bridge": 6,
    "None": 7
}

# 生态枚举
E_Biome = {
    "Temperate_Savanna": 0,
    "Temperate_Forest": 1,
    "Boreal_Tundra": 2,
    "Boreal_Forest": 3,
    "Boreal_Savanna": 4,
    "Tropical_Rainforest": 5,
    "Iceland": 6,
    "Gobi": 7,
    "Desert": 8,
    "Rocky": 9,
    "Saline": 10,
    "Wasteland": 11,
    "Wetland": 12,
    "Dead_Zones": 13,
    "Water": 14,
    "Road": 15,
    "Soil": 16,
    "None": 17
}

# 生态到环境适宜度映射
BiomeToEnvironment = {
    0: 7, 1: 7, 2: 3, 3: 5, 4: 4, 5: 7, 6: 0, 7: 3, 8: 0,
    9: 1, 10: 0, 11: 3, 12: 6, 13: 2, 14: 3, 15: 0, 16: 7
}

def load_heightmap(path):
    """加载16位高度图"""
    img = Image.open(path)
    arr = np.array(img)
    # 16位PNG：R=低8位，G=高8位
    if len(arr.shape) == 3:
        r = arr[:, :, 0]
        g = arr[:, :, 1]
        height = (g.astype(np.uint16) << 8) | r.astype(np.uint16)
    else:
        height = arr.astype(np.uint16)
    return height

def load_material_maps(folder):
    """加载材质权重图"""
    materials = {}
    for filename in os.listdir(folder):
        match = filename.match(r"^(\d+)\.png$")
        if not match:
            continue
        idx = int(match.group(1))
        path = os.path.join(folder, filename)
        img = Image.open(path)
        arr = np.array(img)
        # 取R通道作为权重
        if len(arr.shape) == 3:
            weight = arr[:, :, 0]
        else:
            weight = arr
        materials[idx] = weight
    return materials

def classify_terrain(height, sea_level, plain_threshold, hill_threshold, cell_size, grid_size):
    """根据坡度分类地形"""
    h, w = height.shape
    terrain = np.full((h, w), E_Terrain["None"], dtype=np.uint8)
    
    for y in range(h):
        for x in range(w):
            # 低于海平面 → 水域
            if height[y, x] <= sea_level:
                terrain[y, x] = E_Terrain["Water"]
                continue
            
            max_slope = 0.0
            # 遍历8个邻居
            for oy in (-1, 0, 1):
                for ox in (-1, 0, 1):
                    if ox == 0 and oy == 0:
                        continue
                    nx = x + ox
                    ny = y + oy
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    
                    # 计算距离
                    dist = np.sqrt((ox * cell_size * grid_size)**2 + (oy * cell_size * grid_size)**2)
                    # 计算坡度
                    slope = abs(int(height[ny, nx]) - int(height[y, x])) / dist
                    if slope > max_slope:
                        max_slope = slope
            
            # 分类
            if max_slope <= plain_threshold:
                terrain[y, x] = E_Terrain["Plain"]
            elif max_slope <= hill_threshold:
                terrain[y, x] = E_Terrain["Hill"]
            else:
                terrain[y, x] = E_Terrain["Mountain"]
    
    return terrain

def dfs_enclosed_plains(terrain):
    """DFS处理被包围的平原"""
    h, w = terrain.shape
    visited = np.zeros_like(terrain, dtype=bool)
    directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]
    
    for y in range(h):
        for x in range(w):
            if visited[y, x]:
                continue
            t = terrain[y, x]
            if t != E_Terrain["Plain"] and t != E_Terrain["Hill"]:
                continue
            
            # DFS
            stack = [(y, x)]
            touched = []
            enclosed = True
            
            while stack:
                cy, cx = stack.pop()
                if visited[cy, cx]:
                    continue
                visited[cy, cx] = True
                touched.append((cy, cx))
                
                for dy, dx in directions:
                    ny = cy + dy
                    nx = cx + dx
                    if ny < 0 or nx < 0 or ny >= h or nx >= w:
                        enclosed = False
                        continue
                    if visited[ny, nx]:
                        continue
                    nt = terrain[ny, nx]
                    if nt == E_Terrain["Plain"] or nt == E_Terrain["Hill"]:
                        stack.append((ny, nx))
                        visited[ny, nx] = True
                    elif nt == E_Terrain["Water"]:
                        enclosed = False
            
            # 被包围 → 转为山脉
            if enclosed:
                for cy, cx in touched:
                    terrain[cy, cx] = E_Terrain["Mountain"]
    
    return terrain

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--heightmap", required=True)
    parser.add_argument("--material-folder", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--sea-level", type=int, default=3550)
    parser.add_argument("--plain-threshold", type=float, default=0.30)
    parser.add_argument("--hill-threshold", type=float, default=0.75)
    parser.add_argument("--cell-size", type=int, default=2)
    parser.add_argument("--component-size", type=int, default=510)
    parser.add_argument("--grid-size", type=float, default=100.0)
    args = parser.parse_args()
    
    print("Loading heightmap...")
    height = load_heightmap(args.heightmap)
    
    print("Loading material maps...")
    materials = load_material_maps(args.material_folder)
    
    # 采样尺寸
    width = args.component_size // args.cell_size
    h_h, w_h = height.shape
    # 确保采样不越界
    width = min(width, w_h // args.cell_size, h_h // args.cell_size)
    
    print("Generating grids...")
    grids = []
    for y in range(width):
        for x in range(width):
            grid = {
                "Height": 0,
                "Terrain": E_Terrain["None"],
                "Biome": E_Biome["None"],
                "IsBuild": False,
                "ResourceType": 0,
                "IsSettlement": False,
                "Environment": 0
            }
            
            # 读取高度
            img_x = x * args.cell_size
            img_y = y * args.cell_size
            grid["Height"] = int(height[img_y, img_x])
            
            # 读取材质权重
            max_weight = 0
            biome_idx = E_Biome["None"]
            for i in range(17):
                if i not in materials:
                    continue
                mat = materials[i]
                weight = int(mat[img_y, img_x])
                if weight > max_weight:
                    max_weight = weight
                    biome_idx = i
            
            grid["Biome"] = biome_idx
            grid["Environment"] = BiomeToEnvironment.get(biome_idx, 0)
            
            # 水域标记
            if grid["Biome"] == E_Biome["Water"]:
                grid["Terrain"] = E_Terrain["Water"]
            
            grids.append(grid)
    
    print("Classifying terrain...")
    # 提取高度数组用于坡度计算
    height_grid = np.array([g["Height"] for g in grids]).reshape(width, width)
    terrain_grid = classify_terrain(
        height_grid,
        args.sea_level,
        args.plain_threshold,
        args.hill_threshold,
        args.cell_size,
        args.grid_size
    )
    
    print("DFS enclosed plains...")
    terrain_grid = dfs_enclosed_plains(terrain_grid)
    
    # 回填地形
    for y in range(width):
        for x in range(width):
            idx = y * width + x
            grids[idx]["Terrain"] = int(terrain_grid[y, x])
            # 水域更新Biome
            if grids[idx]["Terrain"] == E_Terrain["Water"]:
                grids[idx]["Biome"] = E_Biome["Water"]
    
    print("Saving JSON...")
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(grids, f, indent=2)
    
    print("Done!")

if __name__ == "__main__":
    main()
