console.log('=== SCRIPT LOADED ===');

// 地形枚举
const E_Terrain = { Plain: 0, Hill: 1, Water: 2, Mountain: 3, Build: 4, Road: 5, Bridge: 6, None: 7 };

// 生态枚举
const E_Biome = {
    Temperate_Savanna: 0, Temperate_Forest: 1, Boreal_Tundra: 2, Boreal_Forest: 3,
    Boreal_Savanna: 4, Tropical_Rainforest: 5, Iceland: 6, Gobi: 7, Desert: 8,
    Rocky: 9, Saline: 10, Wasteland: 11, Wetland: 12, Dead_Zones: 13,
    Water: 14, Road: 15, Soil: 16, None: 17
};

// 生态到环境适宜度映射
const BiomeToEnvironment = {
    0: 7, 1: 7, 2: 3, 3: 5, 4: 4, 5: 7, 6: 0, 7: 3, 8: 0, 9: 1, 10: 0, 11: 3, 12: 6, 13: 2, 14: 3, 15: 0, 16: 7
};

// 状态
let originalImgWidth = 0;
let originalImgHeight = 0;
let heightmapData = null;
let heightmapImage = null;
let materialImages = {};
let materialEnabled = {};
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
const materialList = document.getElementById('material-list');
const clearHeightmapBtn = document.getElementById('clear-heightmap-btn');
const clearMaterialBtn = document.getElementById('clear-material-btn');

// 初始提示
materialList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">请先上传材质权重图</p>';

// 缩放和拖拽状态
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// ========== 高度图上传 ==========
heightmapUpload.addEventListener('click', (e) => {
    console.log('Heightmap upload clicked');
    e.stopPropagation();
    heightmapInput.click();
});

heightmapInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    console.log('Heightmap file selected:', file.name);
    loadHeightmap(file);
});

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
        console.log('Heightmap dropped:', file.name);
        loadHeightmap(file);
    }
});

function loadHeightmap(file) {
    console.log('Loading heightmap...');
    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = function() {
            console.log('Image loaded, size:', img.width, 'x', img.height);
            heightmapImage = img;
            
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const c = canvas.getContext('2d');
            c.drawImage(img, 0, 0);
            heightmapData = c.getImageData(0, 0, img.width, img.height);
            
            heightmapUpload.querySelector('h3').textContent = '高度图已加载: ' + img.width + 'x' + img.height;
            
            // 保存原图尺寸
            originalImgWidth = img.width;
            originalImgHeight = img.height;
            
            // 在大预览框里显示
            console.log('Showing heightmap in big canvas...');
            previewCanvas.width = img.width;
            previewCanvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            // 计算默认缩放：最大边1024像素
            const maxSize = Math.max(img.width, img.height);
            scale = 1024 / maxSize;
            scale = Math.min(scale, 1);
            
            updateCanvasTransform();
            
            console.log('Preview shown with scale:', scale);
        };
        img.src = dataUrl;
    };
    reader.readAsDataURL(file);
}

// ========== 材质图上传 ==========
materialUpload.addEventListener('click', (e) => {
    console.log('Material upload clicked');
    e.stopPropagation();
    materialInput.click();
});

materialInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files).filter(f => f.type === 'image/png');
    console.log('Material files selected:', files.length);
    loadMaterials(files);
});

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
    console.log('Material files dropped:', files.length);
    loadMaterials(files);
});

function loadMaterials(files) {
    console.log('Loading materials...');
    materialImages = {};
    materialEnabled = {};
    materialPreview.innerHTML = '';
    materialList.innerHTML = '';
    
    if (files.length === 0) {
        materialList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">请先上传材质权重图</p>';
        return;
    }
    
    let loaded = 0;
    const total = files.length;
    
    // 提取纯文件名（去掉路径）
    const getPureFilename = (path) => {
        return path.split(/[\\/]/).pop();
    };
    
    const sortedFiles = [...files].sort((a, b) => {
        const aName = getPureFilename(a.name);
        const bName = getPureFilename(b.name);
        const aIdx = parseInt(aName.match(/^(\d+)\.png$/)?.[1] || '999');
        const bIdx = parseInt(bName.match(/^(\d+)\.png$/)?.[1] || '999');
        return aIdx - bIdx;
    });
    
    sortedFiles.forEach(file => {
        const pureName = getPureFilename(file.name);
        const match = pureName.match(/^(\d+)\.png$/);
        if (!match) return;
        
        const index = parseInt(match[1]);
        materialEnabled[index] = true;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const dataUrl = e.target.result;
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const c = canvas.getContext('2d');
                c.drawImage(img, 0, 0);
                materialImages[index] = c.getImageData(0, 0, img.width, img.height);
                
                // 上传预览
                const item = document.createElement('div');
                item.className = 'material-item';
                const previewImg = document.createElement('img');
                previewImg.src = dataUrl;
                const label = document.createElement('span');
                label.textContent = index + '.png';
                item.appendChild(previewImg);
                item.appendChild(label);
                materialPreview.appendChild(item);
                
                // 材质列表面板
                const listItem = document.createElement('div');
                listItem.className = 'material-list-item';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = true;
                checkbox.addEventListener('change', function() {
                    materialEnabled[index] = this.checked;
                });
                const listImg = document.createElement('img');
                listImg.src = dataUrl;
                const listLabel = document.createElement('span');
                listLabel.textContent = index + '.png';
                listItem.appendChild(checkbox);
                listItem.appendChild(listImg);
                listItem.appendChild(listLabel);
                materialList.appendChild(listItem);
                
                loaded++;
                if (loaded === total) {
                    materialUpload.querySelector('h3').textContent = '材质权重图已加载: ' + Object.keys(materialImages).length + '张';
                    console.log('All materials loaded!');
                }
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    });
}

// ========== 清除按钮 ==========
clearHeightmapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    heightmapData = null;
    heightmapImage = null;
    originalImgWidth = 0;
    originalImgHeight = 0;
    heightmapUpload.querySelector('h3').textContent = '拖放高度图 (16位PNG)';
    heightmapInput.value = '';
    previewCanvas.width = 0;
    previewCanvas.height = 0;
});

clearMaterialBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    materialImages = {};
    materialEnabled = {};
    materialPreview.innerHTML = '';
    materialList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">请先上传材质权重图</p>';
    materialUpload.querySelector('h3').textContent = '拖放材质权重图文件夹 (0.png ~ 16.png)';
    materialInput.value = '';
});

// ========== 获取参数 ==========
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

// ========== 生成JSON ==========
generateBtn.addEventListener('click', () => {
    console.log('Generate clicked');
    if (!heightmapData) {
        alert('请先加载高度图');
        return;
    }
    if (Object.keys(materialImages).length === 0) {
        alert('请先加载材质权重图');
        return;
    }
    
    const params = getParams();
    const width = params.componentSize / params.cellSize;
    grids = [];
    
    console.log('Generating grids...', width, 'x', width);
    
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
            
            // 读取高度（16位PNG：R=低8位，G=高8位）
            const imgX = x * params.cellSize;
            const imgY = y * params.cellSize;
            const imgIdx = (imgY * heightmapData.width + imgX) * 4;
            const r = heightmapData.data[imgIdx];
            const g = heightmapData.data[imgIdx + 1];
            grid.Height = (g << 8) | r;
            
            // 读取材质权重（只考虑启用的材质层）
            let maxWeight = 0;
            let biomeIndex = E_Biome.None;
            
            for (let i = 0; i <= 16; i++) {
                if (!materialImages[i] || !materialEnabled[i]) continue;
                
                const matImgX = imgX;
                const matImgY = imgY;
                const matIdx = (matImgY * materialImages[i].width + matImgX) * 4;
                const weight = materialImages[i].data[matIdx]; // R通道
                
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
    
    console.log('Grids loaded, classifying terrain...');
    
    // 2. 根据坡度分类地形
    classifyTerrainBySlope(params);
    
    console.log('Terrain classified, doing DFS...');
    
    // 3. DFS处理被包围的平原
    dfsAnalyzeEnclosedPlains(width);
    
    console.log('DFS done, generating JSON and preview...');
    
    // 生成JSON
    jsonOutput.value = JSON.stringify(grids, null, 2);
    
    // 在大预览框里显示地形分类
    drawTerrainPreview(width);
    
    console.log('Done!');
});

// ========== 根据坡度分类地形 ==========
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

// ========== DFS处理被包围的平原 ==========
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

// ========== 绘制地形分类预览 ==========
function drawTerrainPreview(width) {
    previewCanvas.width = width;
    previewCanvas.height = width;
    
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
    
    // 重置缩放和容器大小（使用地形预览图尺寸）
    originalImgWidth = width;
    originalImgHeight = width;
    const maxSize = Math.max(width, width);
    scale = 1024 / maxSize;
    scale = Math.min(scale, 1);
    updateCanvasTransform();
}

// ========== 预览缩放拖拽 ==========
function scaleAroundCenter(factor) {
    scale = Math.min(Math.max(scale * factor, 0.1), 10);
    updateCanvasTransform();
}

zoomInBtn.addEventListener('click', () => {
    scaleAroundCenter(1.2);
});

zoomOutBtn.addEventListener('click', () => {
    scaleAroundCenter(1 / 1.2);
});

resetZoomBtn.addEventListener('click', () => {
    scale = 1;
    updateCanvasTransform();
});

function updateCanvasTransform() {
    if (!previewCanvas || originalImgWidth === 0) return;
    
    // 计算缩放后的图片尺寸
    const scaledWidth = originalImgWidth * scale;
    const scaledHeight = originalImgHeight * scale;
    
    // canvas-container尺寸 = 缩放后的图片 + 100px边距
    const margin = 100;
    const containerWidth = scaledWidth + margin * 2;
    const containerHeight = scaledHeight + margin * 2;
    canvasContainer.style.width = containerWidth + 'px';
    canvasContainer.style.height = containerHeight + 'px';
    canvasContainer.style.margin = '0 auto';
    
    // 图片在容器里居中（100px边距）
    offsetX = margin;
    offsetY = margin;
    
    previewCanvas.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px) scale(' + scale + ')';
    previewCanvas.style.transformOrigin = '0 0';
    zoomLevelSpan.textContent = '缩放: ' + Math.round(scale * 100) + '%';
}

// ========== 拖拽 ==========
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
    
    previewCanvas.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px) scale(' + scale + ')';
});

canvasContainer.addEventListener('mouseup', () => {
    isDragging = false;
});

canvasContainer.addEventListener('mouseleave', () => {
    isDragging = false;
});

// ========== 滚轮缩放 ==========
canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    const oldScale = scale;
    if (e.deltaY < 0) {
        scale = Math.min(scale * 1.1, 10);
    } else {
        scale = Math.max(scale / 1.1, 0.1);
    }
    
    updateCanvasTransform();
});

// ========== 下载JSON ==========
downloadBtn.addEventListener('click', () => {
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
});

console.log('=== SCRIPT INIT DONE ===');
