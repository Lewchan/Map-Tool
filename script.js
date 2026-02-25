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
        console.log('Reader done, dataUrl length:', dataUrl.length);
        
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
            
            // 显示预览
            console.log('Showing preview...');
            heightmapPreview.innerHTML = '';
            const previewImg = document.createElement('img');
            previewImg.src = dataUrl;
            previewImg.style.maxWidth = '100%';
            previewImg.style.maxHeight = '150px';
            previewImg.style.display = 'block';
            previewImg.style.margin = '10px auto';
            previewImg.style.border = '2px solid #61dafb';
            previewImg.style.borderRadius = '4px';
            heightmapPreview.appendChild(previewImg);
            console.log('Preview shown!');
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
    
    const sortedFiles = [...files].sort((a, b) => {
        const aIdx = parseInt(a.name.match(/^(\\d+)\\.png$/)?.[1] || '999');
        const bIdx = parseInt(b.name.match(/^(\\d+)\\.png$/)?.[1] || '999');
        return aIdx - bIdx;
    });
    
    sortedFiles.forEach(file => {
        const match = file.name.match(/^(\\d+)\\.png$/);
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
    heightmapPreview.innerHTML = '';
    heightmapUpload.querySelector('h3').textContent = '拖放高度图 (16位PNG)';
    heightmapInput.value = '';
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

// ========== 生成JSON ==========
generateBtn.addEventListener('click', () => {
    console.log('Generate clicked');
    if (!heightmapData) {
        alert('请先加载高度图');
        return;
    }
    
    // 简单生成测试JSON，先不写复杂逻辑
    const testData = [{ Height: 3600, Terrain: 0, Biome: 1, Environment: 7 }];
    jsonOutput.value = JSON.stringify(testData, null, 2);
    console.log('Test JSON generated');
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

// ========== 预览缩放拖拽（先简化） ==========
zoomInBtn.addEventListener('click', () => {
    scale = Math.min(scale * 1.2, 10);
    updateCanvasTransform();
});

zoomOutBtn.addEventListener('click', () => {
    scale = Math.max(scale / 1.2, 0.1);
    updateCanvasTransform();
});

resetZoomBtn.addEventListener('click', () => {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    updateCanvasTransform();
});

function updateCanvasTransform() {
    if (!previewCanvas) return;
    previewCanvas.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px) scale(' + scale + ')';
    previewCanvas.style.transformOrigin = '0 0';
    zoomLevelSpan.textContent = '缩放: ' + Math.round(scale * 100) + '%';
}

console.log('=== SCRIPT INIT DONE ===');
