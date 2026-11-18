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
 * y descarta ruido de fondo como texto de teclado o etiquetas "CODE:"
 * Formato oficial: [GRUPO]-[NUMERO]-[CORRELATIVO 5 DÍGITOS] (ej. OF-600-00050, AF-100-00001)
 */
export function sanitizeIndustracCode(rawText) {
    if (!rawText) return null;

    console.log('--- OCR RAW TEXT ---');
    console.log(rawText);

    // 1. Eliminar etiquetas comunes impresas en el sticker como "CODE:", "CODE", "CODIGO:"
    let text = rawText
        .replace(/CODE\s*:\s*/gi, ' ')
        .replace(/CODIGO\s*:\s*/gi, ' ')
        .replace(/COD\s*:\s*/gi, ' ')
        .toUpperCase();

    // 2. Corregir OCR cuando lee cero antes de una letra de familia (0F -> OF, 0SVK -> OSVK)
    text = text.replace(/0(?=[A-Z])/g, 'O');

    // 3. Buscar primero el patrón oficial INDUSTRAC de 3 bloques:
    // Bloque 1: Letras de la familia (OF, AF, OSVK, MMK, MK, etc. de 2 a 5 letras/dígitos ópticos)
    // Bloque 2: Código numérico de familia (100, 600, 700, 704, etc. de 2 a 4 dígitos)
    // Bloque 3: Correlativo de 5 dígitos (00001 a 99999, tolerando letras O, I, S por error óptico)
    const strictPattern = /\b([A-Z0-9]{2,6})[\s\-_.:]+([0-9IOl]{2,4})[\s\-_.:]+([0-9A-Z]{4,6})\b/i;
    let match = text.match(strictPattern);

    if (match) {
        let family = match[1].toUpperCase().replace(/^0/, 'O');
        let num = match[2].toUpperCase().replace(/O/g, '0').replace(/I|L/g, '1');
        let correlative = match[3].toUpperCase();

        // Limpiar correlativo: corregir confusiones ópticas (O -> 0, I -> 1, S -> 5, etc.)
        correlative = correlative
            .replace(/O|D|Q/g, '0')
            .replace(/I|L/g, '1')
            .replace(/Z/g, '2')
            .replace(/S/g, '5')
            .replace(/B/g, '8');

        // Asegurar 5 dígitos
        if (/^\d+$/.test(correlative)) {
            correlative = correlative.padStart(5, '0');
            const finalCode = `${family}-${num}-${correlative}`;
            console.log('✓ Código INDUSTRAC detectado con alta precisión:', finalCode);
            return finalCode;
        }
    }

    // 4. Si no hubo match estricto con separadores, buscar si están pegados (ej. OF60000050 o OF-60000050)
    const fusedPattern = /\b([A-Z0-9]{2,6})[-]?([0-9IOl]{2,4})[-]?([0-9A-Z]{4,6})\b/i;
    let fusedMatch = text.match(fusedPattern);
    if (fusedMatch) {
        let family = fusedMatch[1].toUpperCase().replace(/^0/, 'O');
        let num = fusedMatch[2].toUpperCase().replace(/O/g, '0').replace(/I|L/g, '1');
        let correlative = fusedMatch[3].toUpperCase()
            .replace(/O|D|Q/g, '0')
            .replace(/I|L/g, '1')
            .replace(/S/g, '5');
        if (/^\d+$/.test(correlative)) {
            correlative = correlative.padStart(5, '0');
            const finalCode = `${family}-${num}-${correlative}`;
            console.log('✓ Código INDUSTRAC detectado (unido):', finalCode);
            return finalCode;
        }
    }

    // 5. Búsqueda por línea individual si el texto tiene saltos de línea
    const lines = text.split(/[\r\n]+/);
    for (const line of lines) {
        const lineClean = line.replace(/[^A-Z0-9-]/g, '').trim();
        const lineMatch = lineClean.match(/^([A-Z0-9]{2,6})-([0-9IOl]{2,4})-([0-9A-Z]{4,6})$/i);
        if (lineMatch) {
            let fam = lineMatch[1].replace(/^0/, 'O');
            let n = lineMatch[2].replace(/O/g, '0').replace(/I|L/g, '1');
            let corr = lineMatch[3].replace(/O|D|Q/g, '0').replace(/I|L/g, '1').replace(/S/g, '5').padStart(5, '0');
            if (/^\d+$/.test(corr)) {
                return `${fam}-${n}-${corr}`;
            }
        }
    }

    console.warn('No se detectó un código con el formato de sticker INDUSTRAC.');
    return null;
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
