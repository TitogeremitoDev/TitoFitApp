# Bolt's Journal

## 2025-02-11 - Inline FlatList Render Functions
**Learning:** Defining `renderItem` as an inline function inside `FlatList` component (especially in large files like `entreno.jsx`) causes all list items to re-render whenever the parent state updates. In this app, typing in a single input field triggered a re-render of the entire `Entreno` component, which in turn recreated the `renderItem` function, forcing `FlatList` to re-render all exercise rows and their inputs.
**Action:** Extract list items to `React.memo` components or at least memoize the expensive parts (like Inputs) and ensure callbacks passed to them are stable (using `useCallback`). This converts O(N) re-renders to O(1) for interactions like typing.
