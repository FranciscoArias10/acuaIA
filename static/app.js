// Model specifications configuration
const MODEL_SPECS = {
    'EfficientNetB0': {
        'params': '5.3 Millones',
        'speed': '~80 ms',
        'desc': 'Optimizado para alta precisión con pocos parámetros mediante escalado compuesto equilibrado.'
    },
    'Mobilenetv2': {
        'params': '3.5 Millones',
        'speed': '~45 ms',
        'desc': 'Arquitectura móvil altamente eficiente basada en convoluciones de cuello de botella invertidas.'
    },
    'ResNet50': {
        'params': '25.6 Millones',
        'speed': '~150 ms',
        'desc': 'Red residual clásica de 50 capas. Excelente para evitar el desvanecimiento del gradiente en capas profundas.'
    },
    'VGG16': {
        'params': '15.0 Millones',
        'speed': '~250 ms',
        'desc': 'Clásica red profunda de 16 capas con pequeños filtros de 3x3. Muy estable y de aprendizaje robusto.'
    }
};

// Class style configuration
const CLASS_STYLES = {
    "Healthy (Sano)": { badge: "badge-healthy", border: "border-healthy", color: "#2ecc71" },
    "BG (Branquia Negra)": { badge: "badge-bg", border: "border-bg", color: "#e67e22" },
    "WSSV (Mancha Blanca)": { badge: "badge-wssv", border: "border-wssv", color: "#e74c3c" },
    "BG_WSSV (Coinfección)": { badge: "badge-coinfect", border: "border-coinfect", color: "#9b59b6" }
};

// State variables
let localStream = null;
let isCameraOn = false;
let inferenceMode = 'photo'; // 'photo' or 'realtime'
let isModelLoading = false;
let isPredicting = false;
let realtimeInterval = null;
let backendUrl = localStorage.getItem('backend_url') || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '' : 'https://aquascan-francisco.loca.lt');

// DOM Elements
const archSelect = document.getElementById('arch-select');
const variantSelect = document.getElementById('variant-select');
const metaParams = document.getElementById('meta-params');
const metaSpeed = document.getElementById('meta-speed');
const metaDesc = document.getElementById('meta-desc');
const backendUrlInput = document.getElementById('backend-url-input');

// Helper to get fully qualified API URL
function getApiUrl(endpoint) {
    if (backendUrl) {
        const base = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
        const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        return `${base}${path}`;
    }
    return endpoint;
}

const cameraSelect = document.getElementById('camera-select');
const webcamElement = document.getElementById('webcam');
const cameraPlaceholder = document.getElementById('camera-placeholder');
const realtimeIndicator = document.getElementById('realtime-indicator');
const toggleCameraBtn = document.getElementById('toggle-camera-btn');
const captureBtn = document.getElementById('capture-btn');
const modePhotoBtn = document.getElementById('mode-photo-btn');
const modeStreamBtn = document.getElementById('mode-stream-btn');
const modeUploadBtn = document.getElementById('mode-upload-btn');
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const imagePreview = document.getElementById('image-preview');
const resumeCameraBtn = document.getElementById('resume-camera-btn');
const uploadNewBtn = document.getElementById('upload-new-btn');

const resultEmptyState = document.getElementById('result-empty-state');
const resultContent = document.getElementById('result-content');
const predictedBadge = document.getElementById('predicted-badge');
const confidenceValue = document.getElementById('confidence-value');
const latencyValue = document.getElementById('latency-value');
const probList = document.getElementById('prob-list');
const mainResultCard = document.getElementById('main-result-card');

// Scanning HUD elements
const scanOverlay = document.getElementById('scan-overlay');
const scanBox = document.getElementById('scan-box');
const scanClass = document.getElementById('scan-class');
const scanConf = document.getElementById('scan-conf');

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

// App Initialization
async function initApp() {
    if (backendUrlInput) {
        backendUrlInput.value = backendUrl;
    }
    
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal && !backendUrl) {
        if (metaDesc) {
            metaDesc.innerHTML = `<span style="color:#e67e22;"><i class="fa-solid fa-circle-info"></i> Configura la URL del túnel en el campo 'SERVIDOR'.</span>`;
        }
        return;
    }

    try {
        const response = await fetch(getApiUrl('/api/models'), {
            headers: { 'Bypass-Tunnel-Reminder': 'true' }
        });
        const data = await response.json();
        
        // Populate architecture selector
        archSelect.innerHTML = '';
        Object.keys(data.available_models).forEach(arch => {
            const option = document.createElement('option');
            option.value = arch;
            option.textContent = arch;
            if (arch === data.active_model.architecture) {
                option.selected = true;
            }
            archSelect.appendChild(option);
        });

        // Trigger variant load for active model
        updateVariants(data.available_models, data.active_model.variant);
        updateModelMeta(archSelect.value);
        
        // Get list of video devices
        await getCameraDevices();
    } catch (error) {
        console.error('Error al inicializar la app:', error);
        alert('Error de conexión con el servidor backend. Por favor verifica la URL del servidor.');
    }
}

// Event Listeners setup
function setupEventListeners() {
    // Model Selectors
    archSelect.addEventListener('change', async () => {
        const arch = archSelect.value;
        updateModelMeta(arch);
        
        // Re-fetch model info to get available variants
        const response = await fetch(getApiUrl('/api/models'), {
            headers: { 'Bypass-Tunnel-Reminder': 'true' }
        });
        const data = await response.json();
        updateVariants(data.available_models);
        
        // Auto select first variant and load it
        await loadSelectedModel();
    });

    variantSelect.addEventListener('change', loadSelectedModel);

    // Backend Server URL input handler
    if (backendUrlInput) {
        backendUrlInput.addEventListener('change', () => {
            let value = backendUrlInput.value.trim();
            if (value && !/^https?:\/\//i.test(value)) {
                value = 'http://' + value;
            }
            backendUrl = value;
            localStorage.setItem('backend_url', backendUrl);
            initApp();
        });
    }

    // Camera Toggle
    toggleCameraBtn.addEventListener('click', toggleCamera);

    // Capture Button
    captureBtn.addEventListener('click', captureSingleFrame);

    // Mode Buttons
    modePhotoBtn.addEventListener('click', () => setInferenceMode('photo'));
    modeStreamBtn.addEventListener('click', () => setInferenceMode('realtime'));
    modeUploadBtn.addEventListener('click', () => setInferenceMode('upload'));

    // Resume camera button
    resumeCameraBtn.addEventListener('click', resumeLiveCamera);
    
    // Upload New button
    uploadNewBtn.addEventListener('click', () => fileInput.click());

    // Upload Zone Click & Drag Handlers
    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleImageUpload(e.target.files[0]);
        }
    });

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleImageUpload(e.dataTransfer.files[0]);
        }
    });

    // Camera Input Change
    cameraSelect.addEventListener('change', () => {
        resumeLiveCamera();
        if (isCameraOn) {
            stopCamera();
            startCamera();
        }
    });

    // Educational Guide Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// Update variant options based on selected architecture
function updateVariants(availableModels, selectVariant = null) {
    const arch = archSelect.value;
    const variants = availableModels[arch] || [];
    
    variantSelect.innerHTML = '';
    variants.forEach(variant => {
        const option = document.createElement('option');
        option.value = variant;
        option.textContent = variant;
        if (selectVariant && variant === selectVariant) {
            option.selected = true;
        }
        variantSelect.appendChild(option);
    });
}

// Update model specifications display
function updateModelMeta(arch) {
    const spec = MODEL_SPECS[arch];
    if (spec) {
        metaParams.textContent = spec.params;
        metaSpeed.textContent = spec.speed;
        metaDesc.textContent = spec.desc;
    }
}

// Load selected model to backend memory
async function loadSelectedModel() {
    const architecture = archSelect.value;
    const variant = variantSelect.value;
    if (!architecture || !variant) return;

    isModelLoading = true;
    archSelect.disabled = true;
    variantSelect.disabled = true;
    
    const originalDesc = metaDesc.textContent;
    metaDesc.innerHTML = `<span style="color:#00d2ff;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando pesos en el servidor... Esto puede tardar unos segundos.</span>`;

    try {
        const response = await fetch(getApiUrl('/api/select-model'), {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'true'
            },
            body: JSON.stringify({ architecture, variant })
        });
        
        if (!response.ok) {
            throw new Error('No se pudo cargar el modelo.');
        }
        
        console.log(`Modelo ${architecture} (${variant}) cargado exitosamente.`);
    } catch (error) {
        console.error(error);
        alert(`Error al cargar el modelo: ${error.message}`);
    } finally {
        isModelLoading = false;
        archSelect.disabled = false;
        variantSelect.disabled = false;
        updateModelMeta(architecture);
    }
}

// Enumerate available video inputs
async function getCameraDevices() {
    try {
        // Request initial permission to access media devices to get label details
        await navigator.mediaDevices.getUserMedia({ video: true });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        cameraSelect.innerHTML = '';
        if (videoDevices.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No se detectaron cámaras';
            cameraSelect.appendChild(option);
            cameraSelect.disabled = true;
            return;
        }

        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Cámara ${index + 1}`;
            cameraSelect.appendChild(option);
        });
        cameraSelect.disabled = false;
    } catch (error) {
        console.warn('Error al enumerar dispositivos de cámara:', error);
        cameraSelect.innerHTML = '<option value="">Permiso de cámara denegado</option>';
        cameraSelect.disabled = true;
    }
}

// Toggle camera state
async function toggleCamera() {
    if (isCameraOn) {
        stopCamera();
    } else {
        await startCamera();
    }
}

// Start camera stream
async function startCamera() {
    const deviceId = cameraSelect.value;
    const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true
    };

    try {
        toggleCameraBtn.disabled = true;
        toggleCameraBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Conectando...`;
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        webcamElement.srcObject = localStream;
        cameraPlaceholder.style.opacity = '0';
        setTimeout(() => {
            cameraPlaceholder.style.display = 'none';
        }, 300);
        
        // Show scan overlay and reset to default scanning status
        if (scanOverlay && scanBox && scanClass && scanConf) {
            scanOverlay.style.display = 'flex';
            scanBox.className = 'scan-box';
            scanClass.textContent = 'ESCANEANDO...';
            scanConf.textContent = '';
        }
        
        isCameraOn = true;
        toggleCameraBtn.innerHTML = `<i class="fa-solid fa-power-off"></i> Apagar Cámara`;
        toggleCameraBtn.classList.remove('btn-primary');
        toggleCameraBtn.classList.add('btn-danger');
        toggleCameraBtn.disabled = false;
        
        captureBtn.disabled = (inferenceMode !== 'photo');
        
        // If real-time mode is active, trigger the loop
        if (inferenceMode === 'realtime') {
            startRealtimeInference();
        }
    } catch (error) {
        console.error('Error al encender la cámara:', error);
        alert('No se pudo acceder a la cámara seleccionada. Verifique los permisos.');
        stopCamera();
    }
}

// Stop camera stream
function stopCamera() {
    stopRealtimeInference();
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    webcamElement.srcObject = null;
    
    if (inferenceMode !== 'upload') {
        cameraPlaceholder.style.display = 'flex';
        setTimeout(() => {
            if (inferenceMode !== 'upload') {
                cameraPlaceholder.style.opacity = '1';
            }
        }, 50);
    } else {
        cameraPlaceholder.style.display = 'none';
    }

    // Hide scan overlay when camera is turned off
    if (scanOverlay) {
        scanOverlay.style.display = 'none';
    }

    isCameraOn = false;
    toggleCameraBtn.innerHTML = `<i class="fa-solid fa-power-off"></i> Iniciar Cámara`;
    toggleCameraBtn.classList.remove('btn-danger');
    toggleCameraBtn.classList.add('btn-primary');
    toggleCameraBtn.disabled = false;
    captureBtn.disabled = true;
}

// Switch between photo, stream and upload inference mode
function setInferenceMode(mode) {
    if (inferenceMode === mode) return;

    inferenceMode = mode;
    
    // Reset active classes on mode buttons
    modePhotoBtn.classList.remove('active');
    modeStreamBtn.classList.remove('active');
    modeUploadBtn.classList.remove('active');

    // Hide elements specific to upload/camera
    uploadZone.style.display = 'none';
    uploadNewBtn.style.display = 'none';
    
    if (mode === 'photo') {
        modePhotoBtn.classList.add('active');
        cameraSelect.parentElement.parentElement.style.display = 'block';
        
        // Show camera/video elements
        webcamElement.style.display = 'block';
        cameraPlaceholder.style.display = isCameraOn ? 'none' : 'flex';
        cameraPlaceholder.style.opacity = isCameraOn ? '0' : '1';
        
        // Buttons
        toggleCameraBtn.style.display = 'flex';
        captureBtn.style.display = 'flex';
        resumeCameraBtn.style.display = 'none';
        
        // If image preview had something, clear it
        imagePreview.style.display = 'none';
        imagePreview.src = '';
        
        captureBtn.disabled = !isCameraOn;
        realtimeIndicator.style.display = 'none';
        stopRealtimeInference();
    } else if (mode === 'realtime') {
        modeStreamBtn.classList.add('active');
        cameraSelect.parentElement.parentElement.style.display = 'block';
        
        // Show camera/video elements
        webcamElement.style.display = 'block';
        cameraPlaceholder.style.display = isCameraOn ? 'none' : 'flex';
        cameraPlaceholder.style.opacity = isCameraOn ? '0' : '1';
        
        // Buttons
        toggleCameraBtn.style.display = 'flex';
        captureBtn.style.display = 'flex';
        captureBtn.disabled = true;
        resumeCameraBtn.style.display = 'none';
        
        // If image preview had something, clear it
        imagePreview.style.display = 'none';
        imagePreview.src = '';
        
        if (isCameraOn) {
            startRealtimeInference();
        } else {
            realtimeIndicator.style.display = 'none';
            stopRealtimeInference();
        }
    } else if (mode === 'upload') {
        modeUploadBtn.classList.add('active');
        
        // Stop camera stream completely if on
        if (isCameraOn) {
            stopCamera();
        }
        
        // Hide all camera-related elements from left card
        cameraSelect.parentElement.parentElement.style.display = 'none';
        webcamElement.style.display = 'none';
        cameraPlaceholder.style.display = 'none';
        realtimeIndicator.style.display = 'none';
        scanOverlay.style.display = 'none';
        
        toggleCameraBtn.style.display = 'none';
        captureBtn.style.display = 'none';
        resumeCameraBtn.style.display = 'none';
        
        // Check if we have an image preview active
        if (imagePreview.src && imagePreview.src !== window.location.href && !imagePreview.src.endsWith('/')) {
            imagePreview.style.display = 'block';
            uploadNewBtn.style.display = 'flex';
        } else {
            imagePreview.style.display = 'none';
            uploadZone.style.display = 'flex';
        }
    }
}

// Capture frame and draw to canvas, return as JPEG base64
function captureFrameBase64() {
    const canvas = document.getElementById('capture-canvas');
    const ctx = canvas.getContext('2d');
    
    // Match canvas width/height to webcam element actual aspect ratio if possible
    canvas.width = webcamElement.videoWidth || 640;
    canvas.height = webcamElement.videoHeight || 480;
    
    ctx.drawImage(webcamElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
}

// Resume live camera feed after freezing snapshot
function resumeLiveCamera() {
    // Hide preview image
    imagePreview.style.display = 'none';
    imagePreview.src = '';
    
    // Show webcam element
    webcamElement.style.display = 'block';
    if (scanOverlay && isCameraOn) scanOverlay.style.display = 'flex';
    
    // Reset buttons
    resumeCameraBtn.style.display = 'none';
    toggleCameraBtn.style.display = 'flex';
    captureBtn.style.display = 'flex';
    captureBtn.disabled = !isCameraOn;
}

// Handle selected or dropped image file
function handleImageUpload(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('Por favor, seleccione un archivo de imagen válido.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64Image = e.target.result;
        
        // Show image preview
        imagePreview.src = base64Image;
        imagePreview.style.display = 'block';
        uploadZone.style.display = 'none';
        
        // Update button group
        if (inferenceMode === 'upload') {
            uploadNewBtn.style.display = 'flex';
        }
        
        // Create prediction loading indicator on diagnostic panel
        resultEmptyState.style.display = 'none';
        resultContent.style.display = 'none';
        
        // Remove existing loader if any
        const existingLs = document.getElementById('prediction-loading');
        if (existingLs) existingLs.remove();
        
        const loadingState = document.createElement('div');
        loadingState.id = 'prediction-loading';
        loadingState.className = 'diagnostic-empty-state';
        loadingState.innerHTML = `
            <i class="fa-solid fa-circle-notch fa-spin empty-icon" style="color: #00d2ff;"></i>
            <p>Analizando la imagen cargada...</p>
            <span class="empty-hint">El modelo de IA está procesando el diagnóstico.</span>
        `;
        mainResultCard.appendChild(loadingState);

        try {
            await sendPrediction(base64Image);
        } catch (error) {
            console.error(error);
        } finally {
            const ls = document.getElementById('prediction-loading');
            if (ls) ls.remove();
        }
    };
    reader.readAsDataURL(file);
}

// Capture a single frame manually (Photo Mode)
async function captureSingleFrame() {
    if (!isCameraOn || isPredicting) return;
    
    isPredicting = true;
    captureBtn.disabled = true;
    captureBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analizando...`;
    
    const base64Image = captureFrameBase64();
    
    // Freeze camera view by showing preview image
    imagePreview.src = base64Image;
    imagePreview.style.display = 'block';
    webcamElement.style.display = 'none';
    if (scanOverlay) scanOverlay.style.display = 'none';
    
    // Update buttons
    toggleCameraBtn.style.display = 'none';
    captureBtn.style.display = 'none';
    resumeCameraBtn.style.display = 'flex';
    
    // Create prediction loading indicator
    resultEmptyState.style.display = 'none';
    resultContent.style.display = 'none';
    
    // Remove existing loader if any
    const existingLs = document.getElementById('prediction-loading');
    if (existingLs) existingLs.remove();
    
    const loadingState = document.createElement('div');
    loadingState.id = 'prediction-loading';
    loadingState.className = 'diagnostic-empty-state';
    loadingState.innerHTML = `
        <i class="fa-solid fa-circle-notch fa-spin empty-icon" style="color: #00d2ff;"></i>
        <p>Analizando captura de pantalla...</p>
        <span class="empty-hint">El modelo de IA está procesando el diagnóstico.</span>
    `;
    mainResultCard.appendChild(loadingState);

    try {
        await sendPrediction(base64Image);
    } catch (error) {
        console.error(error);
    } finally {
        isPredicting = false;
        captureBtn.disabled = false;
        captureBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Analizar Imagen`;
        const ls = document.getElementById('prediction-loading');
        if (ls) ls.remove();
    }
}

// Start continuous loop for real-time inference
function startRealtimeInference() {
    stopRealtimeInference();
    realtimeIndicator.style.display = 'flex';
    
    // Recursive loop using setTimeout to prevent overlap
    async function loop() {
        if (!isCameraOn || inferenceMode !== 'realtime') return;
        
        if (!isPredicting) {
            isPredicting = true;
            const base64Image = captureFrameBase64();
            await sendPrediction(base64Image);
            isPredicting = false;
        }
        
        // Wait 600ms before next frame to avoid hitting server too hard
        realtimeInterval = setTimeout(loop, 600);
    }
    
    loop();
}

// Cancel continuous loop
function stopRealtimeInference() {
    realtimeIndicator.style.display = 'none';
    if (realtimeInterval) {
        clearTimeout(realtimeInterval);
        realtimeInterval = null;
    }
}

// Send base64 frame to FastAPI backend
async function sendPrediction(base64Image) {
    try {
        const response = await fetch(getApiUrl('/api/predict'), {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'true'
            },
            body: JSON.stringify({ image: base64Image })
        });
        
        if (!response.ok) {
            throw new Error('La petición de predicción falló.');
        }

        const data = await response.json();
        if (data.status === 'success') {
            updateDiagnosticUI(data.prediction);
        }
    } catch (error) {
        console.error('Error durante la inferencia:', error);
    }
}

// Update diagnostic panel elements dynamically
function updateDiagnosticUI(pred) {
    // Hide empty state and show results
    resultEmptyState.style.display = 'none';
    resultContent.style.display = 'block';

    const pClass = pred.class;
    const confidence = pred.confidence;
    const latency = pred.latency_ms;
    const details = pred.details;
    const probabilities = pred.probabilities;

    // Update scanning overlay HUD with class name and percentage
    if (scanOverlay && scanBox && scanClass && scanConf) {
        scanClass.textContent = pClass.toUpperCase();
        scanConf.textContent = `${(confidence * 100).toFixed(1)}%`;
        
        // Clear previous state classes and assign corresponding status class
        scanBox.className = 'scan-box';
        if (pClass === "Healthy (Sano)") {
            scanBox.classList.add('status-healthy');
        } else if (pClass === "BG (Branquia Negra)") {
            scanBox.classList.add('status-bg');
        } else if (pClass === "WSSV (Mancha Blanca)") {
            scanBox.classList.add('status-wssv');
        } else if (pClass === "BG_WSSV (Coinfección)") {
            scanBox.classList.add('status-coinfect');
        }
    }

    // 1. Update main card border and badge style
    const style = CLASS_STYLES[pClass] || { badge: "", border: "", color: "#ffffff" };
    
    // Reset borders
    mainResultCard.classList.remove('border-healthy', 'border-bg', 'border-wssv', 'border-coinfect');
    if (style.border) {
        mainResultCard.classList.add(style.border);
    }

    predictedBadge.className = `badge ${style.badge}`;
    predictedBadge.textContent = pClass;

    // 2. Update confidence & latency values
    confidenceValue.textContent = `${(confidence * 100).toFixed(2)}%`;
    latencyValue.textContent = `${latency.toFixed(1)} ms`;

    // 3. Populate probability distribution bars
    probList.innerHTML = '';
    Object.entries(probabilities).forEach(([className, prob]) => {
        const itemStyle = CLASS_STYLES[className] || { color: '#ffffff' };
        const probPct = (prob * 100).toFixed(1);
        
        const barItem = document.createElement('div');
        barItem.className = 'prob-bar-item';
        barItem.innerHTML = `
            <div class="prob-bar-meta">
                <span class="prob-class-name">${className}</span>
                <span class="prob-percentage">${probPct}%</span>
            </div>
            <div class="prob-bar-bg">
                <div class="prob-bar-fill" style="background-color: ${itemStyle.color}; width: ${probPct}%;"></div>
            </div>
        `;
        probList.appendChild(barItem);
    });

    // 4. Switch the tab of the pathogen guide automatically
    const classToTabId = {
        "Healthy (Sano)": "tab-healthy",
        "BG (Branquia Negra)": "tab-bg",
        "WSSV (Mancha Blanca)": "tab-wssv",
        "BG_WSSV (Coinfección)": "tab-coinfect"
    };
    const targetTabId = classToTabId[pClass];
    if (targetTabId) {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            if (btn.getAttribute('data-tab') === targetTabId) {
                // Simulate click to switch active tab
                btn.click();
            }
        });
    }
}
