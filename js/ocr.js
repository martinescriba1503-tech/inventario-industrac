/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo de Cámara y Reconocimiento OCR de Alta Precisión (Versión 1.3)
 * Soporta cámara web en vivo, captura nativa de celular, preprocesamiento adaptativo y corrección de caracteres
 */

let videoStream = null;
let tesseractWorker = null;
let isWorkerInitializing = false;

/**
 * Inicializa el worker de Tesseract optimizado
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
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789- ',
            tessedit_pageseg_mode: '6' // Bloque uniforme de texto
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
 * Inicia la transmisión de la cámara trasera con autoenfoque
 */
export async function startCameraStream(videoElement) {
    stopCameraStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara no es compatible con este navegador o requiere conexión HTTPS.');
    }

    const constraints = {
        video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 }
        },
        audio: false
    };

    try {
        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = videoStream;
        await videoElement.play();

        // Aplicar enfoque continuo si el hardware lo soporta
        const track = videoStream.getVideoTracks()[0];
        if (track && track.getCapabilities) {
            const capabilities = track.getCapabilities();
            if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
                try {
                    await track.applyConstraints({
                        advanced: [{ focusMode: 'continuous' }]
                    });
                } catch (e) {
                    console.log('Enfoque continuo no soportado directamente:', e);
                }
            }
        }

        return videoStream;
    } catch (err) {
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            videoElement.srcObject = videoStream;
            await videoElement.play();
            return videoStream;
        } catch (fallbackErr) {
            throw new Error(`Permiso de cámara denegado o no disponible: ${fallbackErr.message}`);
        }
    }
}

/**
 * Detiene la transmisión de la cámara
 */
export function stopCameraStream() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

/**
 * Captura y preprocesa el área de enfoque con escala y binarización adaptativa
 * @param {HTMLVideoElement} videoElement Elemento de video
 * @param {HTMLCanvasElement} canvasElement Canvas destino
 * @returns {string} DataURL de la imagen procesada
 */
export function captureAndPreprocessFrame(videoElement, canvasElement) {
    if (!videoElement || videoElement.videoWidth === 0) return null;

    const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
    const vWidth = videoElement.videoWidth;
    const vHeight = videoElement.videoHeight;

    // Área de enfoque amplia (75% ancho y 45% alto) para no cortar el texto
    const roiWidth = Math.floor(vWidth * 0.85);
    const roiHeight = Math.floor(vHeight * 0.45);
    const startX = Math.floor((vWidth - roiWidth) / 2);
    const startY = Math.floor((vHeight - roiHeight) / 2);

    // Escalar 1.5x para que Tesseract tenga mayor densidad de píxeles
    const scale = 1.5;
    canvasElement.width = Math.floor(roiWidth * scale);
    canvasElement.height = Math.floor(roiHeight * scale);

    // Dibujar ROI con escala
    ctx.drawImage(
        videoElement, 
        startX, startY, roiWidth, roiHeight, 
        0, 0, canvasElement.width, canvasElement.height
    );

    // Preprocesamiento de píxeles: Umbral Adaptativo Otsu / Media Local
    preprocessCanvasAdaptive(canvasElement);

    return canvasElement.toDataURL('image/png');
}

/**
 * Preprocesa cualquier elemento Canvas o Imagen (escala de grises, contraste y umbral)
 */
export function preprocessCanvasAdaptive(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;

    // 1. Calcular luminancia promedio para umbral dinámico (no estático)
    let totalLum = 0;
    const count = d.length / 4;

    for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        totalLum += lum;
    }

    const avgLum = totalLum / count;
    // Umbral ligeramente por debajo del promedio para resaltar letras oscuras sobre fondo blanco
    const threshold = Math.max(90, Math.min(160, avgLum * 0.92));

    for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const val = gray < threshold ? 0 : 255;
        d[i] = val;     // R
        d[i + 1] = val; // G
        d[i + 2] = val; // B
    }

    ctx.putImageData(imgData, 0, 0);
}

/**
 * Preprocesa un archivo de imagen subido (por cámara nativa del celular)
 */
export function preprocessImageFile(file, canvasElement) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
                // Redimensionar si es muy grande para acelerar OCR
                const maxDim = 1600;
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round((h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = Math.round((w * maxDim) / h);
                        h = maxDim;
                    }
                }
                canvasElement.width = w;
                canvasElement.height = h;
                ctx.drawImage(img, 0, 0, w, h);
                preprocessCanvasAdaptive(canvasElement);
                resolve(canvasElement);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Corrige confusiones ópticas comunes de OCR en códigos de almacén INDUSTRAC
 * ej. OF-600-O0001 -> OF-600-00001 (letra O por número 0)
 */
export function sanitizeIndustracCode(rawText) {
    if (!rawText) return null;

    // Normalizar: mayúsculas, cambiar espacios o puntos entre grupos por guiones
    let clean = rawText.toUpperCase()
        .replace(/[\.\s_]+/g, '-')
        .replace(/[^A-Z0-9-]/g, '')
        .trim();

    // Eliminar guiones múltiples
    clean = clean.replace(/-+/g, '-');

    // Patrón 1: Formato triple con correlativo: GRUPO-NUMERO-CORRELATIVO (ej. AF-100-00001, OSVK-704-00002)
    let match = clean.match(/([A-Z0-9]+)-([A-Z0-9]+)-([A-Z0-9]+)/);
    if (match) {
        const prefix1 = match[1];
        const prefix2 = match[2];
        let suffix = match[3];

        // Corregir ópticamente el correlativo final (reemplazar letras por números)
        suffix = suffix
            .replace(/O|o|D|Q/g, '0')
            .replace(/I|l|L/g, '1')
            .replace(/Z/g, '2')
            .replace(/S/g, '5')
            .replace(/B/g, '8');

        // Formatear correlativo a 5 dígitos si tiene dígitos
        if (/^\d+$/.test(suffix)) {
            suffix = suffix.padStart(5, '0');
        }

        return `${prefix1}-${prefix2}-${suffix}`;
    }

    // Patrón 2: Formato doble (ej. MK-100 o similar)
    match = clean.match(/([A-Z0-9]+)-([A-Z0-9]+)/);
    if (match) {
        return match[0];
    }

    return clean.length >= 4 ? clean : null;
}

/**
 * Reconoce el sticker a partir de una imagen o canvas
 */
export async function recognizeStickerCode(imageSource) {
    const worker = await initTesseract();
    if (!worker) return null;

    try {
        const result = await worker.recognize(imageSource);
        const rawText = result?.data?.text || '';
        console.log('Texto crudo OCR detectado:', rawText);

        const sanitized = sanitizeIndustracCode(rawText);
        console.log('Código sanitizado:', sanitized);

        return sanitized;
    } catch (err) {
        console.error('Error durante reconocimiento OCR:', err);
        return null;
    }
}
