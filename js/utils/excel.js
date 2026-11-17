/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Utilidades para Importación y Exportación de Archivos Excel/CSV
 * Utiliza la librería SheetJS (XLSX)
 */

/**
 * Parsea un archivo Excel (.xlsx / .xls) o CSV a una lista de objetos JSON
 * @param {File} file Archivo seleccionado
 * @returns {Promise<Array<Object>>}
 */
export function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
        if (!window.XLSX) {
            reject(new Error('La librería XLSX no está cargada.'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                resolve(jsonData);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Exporta un arreglo de datos JSON a un archivo .xlsx descargable
 * @param {Array<Object>} data Arreglo de objetos a exportar
 * @param {string} fileName Nombre del archivo sin extensión
 * @param {string} sheetName Nombre de la hoja
 */
export function exportToExcel(data, fileName = 'Reporte_INDUSTRAC', sheetName = 'Datos') {
    if (!window.XLSX) {
        alert('La librería XLSX no está disponible.');
        return;
    }

    if (!data || data.length === 0) {
        alert('No hay datos para exportar.');
        return;
    }

    const worksheet = window.XLSX.utils.json_to_sheet(data);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const fullFileName = `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    window.XLSX.writeFile(workbook, fullFileName);
}

