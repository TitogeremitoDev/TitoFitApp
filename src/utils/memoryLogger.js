/**
 * Memory diagnostic logger for tracking Chrome SIGILL crashes.
 * Uses performance.memory (Chrome-only API) to log heap usage.
 * Safe no-op on Firefox/Safari/native.
 *
 * Usage:
 *   import { logMemory } from '../utils/memoryLogger';
 *   logMemory('PROGRESS', 'after chart render');
 */
import { Platform } from 'react-native';

const MB = 1024 * 1024;

export const logMemory = (screen, event) => {
    if (Platform.OS !== 'web' || typeof performance === 'undefined' || !performance.memory) return;

    const mem = performance.memory;
    const used = (mem.usedJSHeapSize / MB).toFixed(1);
    const total = (mem.totalJSHeapSize / MB).toFixed(1);
    const limit = (mem.jsHeapSizeLimit / MB).toFixed(1);
    const pct = ((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(0);

    // Count DOM nodes
    const nodes = document.querySelectorAll('*').length;

    const style = pct > 70 ? 'color: red; font-weight: bold'
        : pct > 50 ? 'color: orange; font-weight: bold'
            : 'color: green';

    console.log(
        `%c[MEM ${screen}] ${event} | Heap: ${used}/${total}MB (${pct}%) | Limit: ${limit}MB | DOM: ${nodes} nodes`,
        style
    );

    // Warn if approaching danger zone
    if (pct > 70) {
        console.warn(`⚠️ [MEM ${screen}] HIGH MEMORY: ${used}MB used (${pct}% of limit). DOM nodes: ${nodes}`);
    }
};

/**
 * Hook to log memory on mount/unmount of a component
 */
export const useMemoryLog = (screen) => {
    if (Platform.OS !== 'web') return;

    // We intentionally don't use useEffect to avoid import issues
    // Call logMemory directly where needed
};
