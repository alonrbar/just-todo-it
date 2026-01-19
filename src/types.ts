/**
 * Represents a single TODO comment found in the codebase
 */
export interface TodoItem {
    /** The label extracted from TODO(label) */
    label: string;
    /** The text content after the colon */
    text: string;
    /** Absolute file path */
    filePath: string;
    /** Workspace-relative file path */
    relativePath: string;
    /** Line number (0-based) */
    line: number;
    /** Column position where the TODO starts */
    column: number;
}

/**
 * Types of nodes in the tree view
 */
export type TreeNodeType = 'label' | 'file' | 'todo';

/**
 * Represents a node in the tree view
 */
export interface TreeNode {
    type: TreeNodeType;
    /** Display label for the node */
    name: string;
    /** Child nodes (for label and file nodes) */
    children?: TreeNode[];
    /** The TODO item (only for 'todo' type nodes) */
    todo?: TodoItem;
    /** Count of TODOs under this node */
    count?: number;
}
