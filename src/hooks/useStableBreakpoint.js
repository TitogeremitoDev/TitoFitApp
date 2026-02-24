/**
 * useStableBreakpoint - Debounced responsive breakpoint hook
 *
 * CRITICAL: On web, does NOT use useWindowDimensions() because that triggers
 * a React re-render on EVERY PIXEL of window resize, causing Chrome to crash
 * when components mount/unmount rapidly at layout breakpoints.
 *
 * Instead uses window.addEventListener('resize') with debounce so the
 * component ONLY re-renders once, after resize stops.
 *
 * On native (iOS/Android), uses useWindowDimensions normally (no resize issue).
 */
import { useState, useEffect } from 'react';
import { Platform, Dimensions, useWindowDimensions } from 'react-native';

function useStableBreakpointWeb(breakpoint, delay) {
    const [state, setState] = useState(() => {
        const width = typeof window !== 'undefined' ? window.innerWidth : 375;
        return { isWide: width >= breakpoint, windowWidth: width };
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let timer;
        const handleResize = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                const width = window.innerWidth;
                setState({ isWide: width >= breakpoint, windowWidth: width });
            }, delay);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', handleResize);
        };
    }, [breakpoint, delay]);

    return state;
}

function useStableBreakpointNative(breakpoint) {
    const { width } = useWindowDimensions();
    return { isWide: width >= breakpoint, windowWidth: width };
}

export const useStableBreakpoint = Platform.OS === 'web'
    ? useStableBreakpointWeb
    : useStableBreakpointNative;

// Drop-in replacement for useWindowDimensions() that debounces on web
function useStableWindowDimensionsWeb(delay = 150) {
    const [dims, setDims] = useState(() => {
        if (typeof window !== 'undefined') {
            return { width: window.innerWidth, height: window.innerHeight };
        }
        return { width: 375, height: 812 };
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let timer;
        const handleResize = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                setDims({ width: window.innerWidth, height: window.innerHeight });
            }, delay);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', handleResize);
        };
    }, [delay]);

    return dims;
}

function useStableWindowDimensionsNative() {
    return useWindowDimensions();
}

export const useStableWindowDimensions = Platform.OS === 'web'
    ? useStableWindowDimensionsWeb
    : useStableWindowDimensionsNative;
