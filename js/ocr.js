/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo de Cámara y Reconocimiento OCR de Stickers Alfanuméricos
 * Utiliza MediaDevices API + Canvas Preprocessing + Tesseract.js
 */

let videoStream = null;
let tesseractWorker = null;
let isWorkerInitializing = false;

/**
 * Inicializa el worker de Tesseract con diccionario optimizado para stickers alfanuméricos
 */
export async function initTesseract() {
    if (tesseractWorker) return tesseractWorker;
    if (isWorkerInitializing) {
        while (isWorkerInitializing) {
            await new Promise(r => setTimeout(r, 100));
        }
        return tesseractWorker;
    }

    if (!window.Tesseract) {
        console.error('Librería Tesseract.js no cargada.');
        return null;
    }

    isWorkerInitializing = true;
    try {
        const worker = await window.Tesseract.createWorker('eng');
        await worker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
            tessedit_pageseg_mode: '7' // Tratar la imagen como una sola línea de texto
        });
        tesseractWorker = worker;
        return tesseractWorker;
    } catch (err) {
        console.error('Error inicializando Tesseract:', err);
        return null;
    } finally {
        isWorkerInitializing = false;
    }
}

/**
 * Inicia la transmisión de la cámara trasera del dispositivo móvil
 * @param {HTMLVideoElement} videoElement Elemento de video receptor
 * @returns {Promise<MediaStream>}
 */
export async function startCameraStream(videoElement) {
    stopCameraStream(); // Detener cualquier stream anterior

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara no es compatible con este navegador o requiere conexión HTTPS.');
    }

    const constraints = {
        video: {
            facingMode: { ideal: 'environment' }, // Cámara trasera en celulares
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    };

    try {
        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = videoStream;
        await videoElement.play();
        return videoStream;
    } catch (err) {
        // Reintento con configuración básica si falla la ideal
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            videoElement.srcObject = videoStream;
            await videoElement.play();
            return videoStream;
        } catch (fallbackErr) {
            throw new Error(`Permiso denegado o cámara no disponible: ${fallbackErr.message}`);
        }
    }
}

/**
 * Detiene la transmisión activa de la cámara
 */
export function stopCameraStream() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

/**
 * Captura y preprocesa el área de enfoque (ROI) para maximizar la precisión del OCR
 * Aplica: Escala de grises + Alto Contraste + Binarización
 * @param {HTMLVideoElement} videoElement Elemento de video
 * @param {HTMLCanvasElement} canvasElement Canvas destino
 * @returns {string} DataURL de la imagen procesada
 */
export function captureAndPreprocessFrame(videoElement, canvasElement) {
    if (!videoElement || videoElement.videoWidth === 0) return null;

    const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
    const vWidth = videoElement.videoWidth;
    const vHeight = videoElement.videoHeight;

    // Tomar solo el tercio central donde está la mira de enfoque (ROI)
    const roiWidth = Math.floor(vWidth * 0.85);
    const roiHeight = Math.floor(vHeight * 0.35);
    const startX = Math.floor((vWidth - roiWidth) / 2);
    const startY = Math.floor((vHeight - roiHeight) / 2);

    canvasElement.width = roiWidth;
    canvasElement.height = roiHeight;

    // Dibujar ROI en canvas
    ctx.drawImage(videoElement, startX, startY, roiWidth, roiHeight, 0, 0, roiWidth, roiHeight);

    // Obtener mapa de píxeles
    const imgData = ctx.getImageData(0, 0, roiWidth, roiHeight);
    const d = imgData.data;

    // Preprocesamiento de píxeles: Grayscale y Umbral de contraste (Binarización para texto sobre sticker)
    for (let i = 0; i < d.length; i += 4) {
        // Luminancia
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        // Umbral adaptado: el texto negro queda en 0, el fondo claro en 255
        const value = gray > 135 ? 255 : 0;
        d[i] = value;     // R
        d[i + 1] = value; // G
        d[i + 2] = value; // B
    }

    ctx.putImageData(imgData, 0, 0);
    return canvasElement.toDataURL('image/png');
}

/**
 * Reconoce el texto del sticker a partir de la imagen y extrae el código alfanumérico
 * Formatos comunes de INDUSTRAC: AF-100-00001, OSVK-704-00002, MMK-700-00001, etc.
 * @param {string | HTMLCanvasElement} imageSource 
 * @returns {Promise<string | null>}
 */
export async function recognizeStickerCode(imageSource) {
    const worker = await initTesseract();
    if (!worker) return null;

    try {
        const result = await worker.recognize(imageSource);
        const rawText = result?.data?.text || '';
        
        // Limpieza y búsqueda de patrón de código de almacén
        // Patrón típico: LEFTRAS-NUMEROS-CORRELATIVO (ej: AF-100-00001, OSVK-704-00002)
        const clean = rawText.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
        
        // Expresión regular que busca patrones como AF-100-00001 o texto con guiones
        const match = clean.match(/[A-Z0-9]+-[A-Z0-9]+-[0-9]+/);
        if (match) {
            return match[0];
        }

        // Si no coincide con el formato triple, pero tiene letras y números con guión
        const partialMatch = clean.match(/[A-Z0-9]+-[A-Z0-9]+/);
        if (partialMatch) {
            return partialMatch[0];
        }

        return clean || null;
    } catch (err) {
        console.error('Error durante OCR:', err);
        return null;
    }
}
