/**
 * Formats a size in bytes for display (e.g. 512 B, 4 KB, 1.5 MB)
 * @param bytes - The size in bytes
 * @returns The formatted size
 */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
