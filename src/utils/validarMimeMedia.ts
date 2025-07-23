import { EXTENSIONES_MEDIA_PERMITIDAS } from "./constantes";

export function esExtensionMediaValida(nombreArchivo: string): boolean {
    const partes = nombreArchivo.toLowerCase().split('.');
    const ext = partes[partes.length - 1];
    return EXTENSIONES_MEDIA_PERMITIDAS.includes(ext);
}
