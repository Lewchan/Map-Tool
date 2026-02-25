// 地形枚举
const E_Terrain = {
    Plain: 0,
    Hill: 1,
    Water: 2,
    Mountain: 3,
    Build: 4,
    Road: 5,
    Bridge: 6,
    None: 7
};

// 生态枚举
const E_Biome = {
    Temperate_Savanna: 0,
    Temperate_Forest: 1,
    Boreal_Tundra: 2,
    Boreal_Forest: 3,
    Boreal_Savanna: 4,
    Tropical_Rainforest: 5,
    Iceland: 6,
    Gobi: 7,
    Desert: 8,
    Rocky: 9,
    Saline: 10,
    Wasteland: 11,
    Wetland: 12,
    Dead_Zones: 13,
    Water: 14,
    Road: 15,
    Soil: 16,
    None: 17
};

// 生态到环境适宜度映射
const BiomeToEnvironment = {
    0: 7,   // Temperate_Savanna
    1: 7,   // Temperate_Forest
    2: 3,   // Boreal_Tundra
    3: 5,   // Boreal_Forest
    4: 4,   // Boreal_Savanna
    5: 7,   // Tropical_Rainforest
    6: 0,   // Iceland
    7: 3,   // Gobi
    8: 0,   // Desert
    9: 1,   // Rocky
    10: 0,  // Saline
    11: 3,  // Wasteland
    12: 6,  // Wetland
    13: 2,  // Dead_Zones
    14: 3,  // Water
    15: 0,  // Road
    16: 7   // Soil
};

// 状态
let heightmapData = null;
let heightmapImage = null;
let materialImages = {};
let grids = [];

// DOM元素
const heightmapUpload = document.getElementById('heightmap-upload');
const heightmapInput = document.getElementById('heightmap-input');
const materialUpload = document.getElementById('material-upload');
const materialInput = document.getElementById('material-input');
const generateBtn = document.getElementById('generate-btn');
const jsonOutput = document.getElementById('json-output');
const downloadBtn = document.getElementById('download-btn');
const previewCanvas = document.getElementById('preview-canvas');
const ctx = previewCanvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-container');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const resetZoomBtn = document.getElementById('reset-zoom-btn');
const zoomLevelSpan = document.getElementById('zoom-level');
const overlayToggle = document.getElementById('overlay-toggle');
const heightmapPreview = document.getElementById('heightmap-preview');
const materialPreview = document.getElementById('material-preview');

// 缩放和拖拽状态
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// 拖放高度图
heightmapUpload.addEventListener('click', () => heightmapInput.click());
heightmapInput.addEventListener('change', handleHeightmap);
heightmapUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    heightmapUpload.classList.add('drag-over');
});
heightmapUpload.addEventListener('dragleave', () => {
    heightmapUpload.classList.remove('drag-over');
});
heightmapUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    heightmapUpload.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'image/png') {
        loadHeightmap(file);
    }
});

// 拖放材质权重图
materialUpload.addEventListener('click', () => materialInput.click());
materialInput.addEventListener('change', handleMaterials);
materialUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    materialUpload.classList.add('drag-over');
});
materialUpload.addEventListener('dragleave', () => {
    materialUpload.classList.remove('drag-over');
});
materialUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    materialUpload.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'image/png');
    loadMaterials(files);
});

// 处理高度图
function handleHeightmap(e) {
    const file = e.target.files[0];
    if (file) {
        loadHeightmap(file);
    }
}

// 加载高度图
function loadHeightmap(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            heightmapImage = img;
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const c = canvas.getContext('2d');
            c.drawImage(img, 0, 0);
            heightmapData = c.getImageData(0, 0, img.width, img.height);
            heightmapUpload.querySelector('h3').textContent = `高度图已加载: ${img.width}x${img.height}`;
            
            // 显示预览
            heightmapPreview.innerHTML = '';
            const previewImg = document.createElement('img');
            previewImg.src = e.target.result;
            previewImg.style.maxWidth = '100%';
            previewImg.style.maxHeight = '180px';
            heightmapPreview.appendChild(previewImg);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 处理材质权重图
function handleMaterials(e) {
    const files = Array.from(e.target.files).filter(f => f.type === 'image/png');
    loadMaterials(files);
}

// 加载材质权重图
function loadMaterials(files) {
    materialImages = {};
    materialPreview.innerHTML = '';
    let loaded = 0;
    const total = files.length;
    
    files.forEach(file => {
        const match = file.name.match(/^(\d+)\.png$/);
        if (!match) return;
        
        const index = parseInt(match[1]);
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const c = canvas.getContext('2d');
                c.drawImage(img, 0, 0);
                materialImages[index] = c.getImageData(0, 0, img.width, img.height);
                
                // 显示预览
                const item = document.createElement('div');
                item.className = 'material-item';
                const previewImg = document.createElement('img');
                previewImg.src = e.target.result;
                const label = document.createElement('span');
                label.textContent = `${index}.png`;
                item.appendChild(previewImg);
                item.appendChild(label);
                materialPreview.appendChild(item);
                
                loaded++;
                if (loaded === total) {
                    materialUpload.querySelector('h3').textContent = `材质权重图已加载: ${Object.keys(materialImages).length}张`;
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// 获取参数
function getParams() {
    return {
        seaLevel: parseInt(document.getElementById('sea-level').value),
        plainThreshold: parseFloat(document.getElementById('plain-threshold').value),
        hillThreshold: parseFloat(document.getElementById('hill-threshold').value),
        cellSize: parseInt(document.getElementById('cell-size').value),
        componentSize: parseInt(document.getElementById('component-size').value),
        gridSize: parseFloat(document.getElementById('grid-size').value)
    };
}

// 生成网格数据
function generateGrids() {
    if (!heightmapData) {
        alert('请先加载高度图');
        return;
    }
    
    const params = getParams();
    const width = params.componentSize / params.cellSize;
    grids = [];
    
    // 1. 读取高度和材质
    for (let y = 0; y < width; y++) {
        for (let x = 0; x < width; x++) {
            const grid = {
                Height: 0,
                Terrain: E_Terrain.None,
                Biome: E_Biome.None,
                IsBuild: false,
                ResourceType: 0,
                IsSettlement: false,
                Environment: 0
            };
            
            // 读取高度（从16位PNG，取R通道作为低8位，G通道作为高8位）
            const imgX = x * params.cellSize;
            const imgY = y * params.cellSize;
            const imgIdx = (imgY * heightmapData.width + imgX) * 4;
            const r = heightmapData.data[imgIdx];
            const g = heightmapData.data[imgIdx + 1];
            grid.Height = (g << 8) | r;
            
            // 读取材质权重
            let maxWeight = 0;
            let biomeIndex = E_Biome.None;
            
            for (let i = 0; i <= 16; i++) {
                if (!materialImages[i]) continue;
                
                const matImgX = imgX;
                const matImgY = imgY;
                const matIdx = (matImgY * materialImages[i].width + matImgX) * 4;
                const weight = materialImages[i].data[matIdx]; // 取R通道作为权重
                
                if (weight > maxWeight) {
                    maxWeight = weight;
                    biomeIndex = i;
                }
            }
            
            grid.Biome = biomeIndex;
            grid.Environment = BiomeToEnvironment[biomeIndex] || 0;
            
            // 如果是水域，直接标记
            if (grid.Biome === E_Biome.Water) {
                grid.Terrain = E_Terrain.Water;
            }
            
            grids.push(grid);
        }
    }
    
    // 2. 根据坡度分类地形
    classifyTerrainBySlope(params);
    
    // 3. DFS处理被包围的平原
    dfsAnalyzeEnclosedPlains(width);
    
    // 生成JSON
    const json = JSON.stringify(grids, null, 2);
    jsonOutput.value = json;
    
    // 预览
    drawPreview(width);
}

// 根据坡度分类地形
function classifyTerrainBySlope(params) {
    const width = params.componentSize / params.cellSize;
    
    for (let y = 0; y < width; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const grid = grids[idx];
            
            // 如果已经是水域，跳过
            if (grid.Biome === E_Biome.Water) continue;
            
            // 低于海平面，标记为水域
            if (grid.Height <= params.seaLevel) {
                grid.Terrain = E_Terrain.Water;
                grid.Biome = E_Biome.Water;
                continue;
            }
            
            let maxSlope = 0;
            
            // 遍历8个邻居
            for (let oy = -1; oy <= 1; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
                    if (ox === 0 && oy === 0) continue;
                    
                    const nx = x + ox;
                    const ny = y + oy;
                    
                    if (nx < 0 || ny < 0 || nx >= width || ny >= width) continue;
                    
                    const nIdx = ny * width + nx;
                    const neighborHeight = grids[nIdx].Height;
                    
                    // 计算距离
                    const distance = Math.sqrt(
                        Math.pow(ox * params.cellSize * params.gridSize, 2) +
                        Math.pow(oy * params.cellSize * params.gridSize, 2)
                    );
                    
                    // 计算坡度
                    const slope = Math.abs(neighborHeight - grid.Height) / distance;
                    
                    if (slope > maxSlope) {
                        maxSlope = slope;
                    }
                }
            }
            
            // 根据坡度分类
            if (maxSlope <= params.plainThreshold) {
                grid.Terrain = E_Terrain.Plain;
            } else if (maxSlope <= params.hillThreshold) {
                grid.Terrain = E_Terrain.Hill;
            } else {
                grid.Terrain = E_Terrain.Mountain;
            }
        }
    }
}

// DFS处理被包围的平原
function dfsAnalyzeEnclosedPlains(width) {
    const visited = new Array(grids.length).fill(false);
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    
    for (let i = 0; i < grids.length; i++) {
        if (visited[i]) continue;
        
        const terrain = grids[i].Terrain;
        
        // 只处理平原和丘陵
        if (terrain !== E_Terrain.Plain && terrain !== E_Terrain.Hill) continue;
        
        const stack = [i];
        const touched = [];
        let enclosed = true;
        
        while (stack.length > 0) {
            const current = stack.pop();
            
            if (visited[current]) continue;
            visited[current] = true;
            touched.push(current);
            
            const cx = current % width;
            const cy = Math.floor(current / width);
            
            for (const [dx, dy] of directions) {
                const nx = cx + dx;
                const ny = cy + dy;
                
                if (nx < 0 || ny < 0 || nx >= width || ny >= width) {
                    enclosed = false;
                    continue;
                }
                
                const nIdx = ny * width + nx;
                
                if (visited[nIdx]) continue;
                
                const nTerrain = grids[nIdx].Terrain;
                
                if (nTerrain === E_Terrain.Plain || nTerrain === E_Terrain.Hill) {
                    stack.push(nIdx);
                    visited[nIdx] = true;
                } else if (nTerrain === E_Terrain.Water) {
                    enclosed = false;
                }
            }
        }
        
        // 如果被包围，转为山脉
        if (enclosed) {
            for (const idx of touched) {
                grids[idx].Terrain = E_Terrain.Mountain;
            }
        }
    }
}

// 绘制预览
function drawPreview(width) {
    previewCanvas.width = width;
    previewCanvas.height = width;
    
    if (overlayToggle.checked && heightmapImage) {
        // 叠加预览模式：先画高度图，再半透明画地形分类
        ctx.drawImage(heightmapImage, 0, 0, width, width);
        ctx.globalAlpha = 0.5;
        
        const imageData = ctx.createImageData(width, width);
        
        for (let y = 0; y < width; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const grid = grids[idx];
                const pixelIdx = idx * 4;
                
                // 根据地形类型着色
                let r, g, b;
                
                switch (grid.Terrain) {
                    case E_Terrain.Water:
                        r = 30; g = 64; b = 175;
                        break;
                    case E_Terrain.Plain:
                        r = 86; g = 152; b = 59;
                        break;
                    case E_Terrain.Hill:
                        r = 140; g = 120; b = 80;
                        break;
                    case E_Terrain.Mountain:
                        r = 100; g = 100; b = 100;
                        break;
                    default:
                        r = 0; g = 0; b = 0;
                }
                
                imageData.data[pixelIdx] = r;
                imageData.data[pixelIdx + 1] = g;
                imageData.data[pixelIdx + 2] = b;
                imageData.data[pixelIdx + 3] = 255;
            }
        }
        
        // 先保存当前alpha，再用putImageData（会忽略globalAlpha），所以我们手动混合
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = width;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.globalAlpha = 1.0;
    } else {
        // 普通预览模式：只画地形分类
        const imageData = ctx.createImageData(width, width);
        
        for (let y = 0; y < width; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const grid = grids[idx];
                const pixelIdx = idx * 4;
                
                // 根据地形类型着色
                let r, g, b;
                
                switch (grid.Terrain) {
                    case E_Terrain.Water:
                        r = 30; g = 64; b = 175;
                        break;
                    case E_Terrain.Plain:
                        r = 86; g = 152; b = 59;
                        break;
                    case E_Terrain.Hill:
                        r = 140; g = 120; b = 80;
                        break;
                    case E_Terrain.Mountain:
                        r = 100; g = 100; b = 100;
                        break;
                    default:
                        r = 0; g = 0; b = 0;
                }
                
                imageData.data[pixelIdx] = r;
                imageData.data[pixelIdx + 1] = g;
                imageData.data[pixelIdx + 2] = b;
                imageData.data[pixelIdx + 3] = 255;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    updateCanvasTransform();
}

// 更新画布变换
function updateCanvasTransform() {
    previewCanvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    previewCanvas.style.transformOrigin = '0 0';
    zoomLevelSpan.textContent = `缩放: ${Math.round(scale * 100)}%`;
}

// 缩放
function zoomIn() {
    scale = Math.min(scale * 1.2, 10);
    updateCanvasTransform();
}

function zoomOut() {
    scale = Math.max(scale / 1.2, 0.1);
    updateCanvasTransform();
}

function resetZoom() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    updateCanvasTransform();
}

// 拖拽
canvasContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

canvasContainer.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    
    offsetX += dx;
    offsetY += dy;
    
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    updateCanvasTransform();
});

canvasContainer.addEventListener('mouseup', () => {
    isDragging = false;
});

canvasContainer.addEventListener('mouseleave', () => {
    isDragging = false;
});

// 滚轮缩放
canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const oldScale = scale;
    if (e.deltaY < 0) {
        scale = Math.min(scale * 1.1, 10);
    } else {
        scale = Math.max(scale / 1.1, 0.1);
    }
    
    // 以鼠标为中心缩放
    const scaleChange = scale / oldScale;
    offsetX = mouseX - (mouseX - offsetX) * scaleChange;
    offsetY = mouseY - (mouseY - offsetY) * scaleChange;
    
    updateCanvasTransform();
});

// 事件绑定
zoomInBtn.addEventListener('click', zoomIn);
zoomOutBtn.addEventListener('click', zoomOut);
resetZoomBtn.addEventListener('click', resetZoom);

// 下载JSON
function downloadJson() {
    const json = jsonOutput.value;
    if (!json) {
        alert('请先生成JSON');
        return;
    }
    
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MapData.json';
    a.click();
    URL.revokeObjectURL(url);
}

// 事件绑定
generateBtn.addEventListener('click', generateGrids);
downloadBtn.addEventListener('click', downloadJson);
