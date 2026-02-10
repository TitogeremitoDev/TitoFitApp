## 2024-05-23 - Large File Refactoring
**Learning:** When refactoring massive React components (>5000 lines), automated search/replace (sed/python) is risky due to identical code blocks appearing in different contexts (e.g. `return (` inside modals vs main render).
**Action:** Use specific unique anchors or split the file into smaller components before attempting logic changes if possible. If not, verify structure manually by checking brace balance.
