/**
 * LazySection - Only mounts children when visible in viewport (web only)
 *
 * On web, uses IntersectionObserver to defer rendering of heavy sections
 * until they scroll into view. Once mounted, stays mounted (no unmount on scroll out)
 * to avoid re-render storms.
 *
 * On native, renders children immediately (no DOM issue on native).
 *
 * Props:
 *   - height: estimated height for placeholder (default 200)
 *   - style: optional container style
 *   - children: the heavy content to lazy render
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Platform, ActivityIndicator } from 'react-native';

function LazySectionWeb({ height = 200, style, children }) {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.IntersectionObserver) {
            setIsVisible(true);
            return;
        }

        const node = ref.current;
        if (!node) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect(); // Once visible, stay mounted forever
                }
            },
            { rootMargin: '200px' } // Start loading 200px before entering viewport
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    return (
        <View ref={ref} style={style}>
            {isVisible ? children : (
                <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#94a3b8" />
                </View>
            )}
        </View>
    );
}

function LazySectionNative({ children, style }) {
    return <View style={style}>{children}</View>;
}

const LazySection = Platform.OS === 'web' ? LazySectionWeb : LazySectionNative;
export default LazySection;
