import * as vscode from 'vscode';
import { TodoItem } from './types';
import { fuzzyMatch, createSearchableString } from './utils';
import { TodoTreeItem } from './todoTreeItem';

/**
 * View mode for the TODO tree
 * - grouped: Label → File → TODOs (full hierarchy)
 * - byTag: Label → TODOs (flat within each tag)
 * - flat: All TODOs in a flat list
 */
export type ViewMode = 'grouped' | 'byTag' | 'flat';

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
    grouped: 'Grouped by Tag & File',
    byTag: 'Grouped by Tag',
    flat: 'Flat'
};

/**
 * Provides data for the TODO tree view
 */
export class TodoTreeProvider implements vscode.TreeDataProvider<TodoTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TodoTreeItem | undefined | null | void> =
        new vscode.EventEmitter<TodoTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TodoTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private todos: TodoItem[] = [];
    private viewMode: ViewMode = 'grouped';
    private filterPattern: string = '';

    /**
     * Updates the TODO list and refreshes the tree
     * @param todos - New list of TODO items
     */
    setTodos(todos: TodoItem[]): void {
        this.todos = todos;
        this.refresh();
    }

    /**
     * Gets all TODO items (unfiltered)
     */
    getTodos(): TodoItem[] {
        return this.todos;
    }

    /**
     * Cycles through view modes: grouped → byTag → flat → grouped
     * @returns The new view mode label for display
     */
    toggleViewMode(): string {
        const modes: ViewMode[] = ['grouped', 'byTag', 'flat'];
        const currentIndex = modes.indexOf(this.viewMode);
        this.viewMode = modes[(currentIndex + 1) % modes.length];
        this.refresh();
        return VIEW_MODE_LABELS[this.viewMode];
    }

    /**
     * Gets the current view mode
     */
    getViewMode(): ViewMode {
        return this.viewMode;
    }

    /**
     * Gets the current view mode label for display
     */
    getViewModeLabel(): string {
        return VIEW_MODE_LABELS[this.viewMode];
    }

    /**
     * Sets the filter pattern for fuzzy matching
     * @param pattern - The filter pattern (empty string to clear)
     */
    setFilter(pattern: string): void {
        this.filterPattern = pattern;
        this.refresh();
    }

    /**
     * Gets the current filter pattern
     */
    getFilter(): string {
        return this.filterPattern;
    }

    /**
     * Refreshes the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Returns the filtered list of TODOs based on the current filter pattern
     * Supports special syntax: @label for exact label matching
     */
    private getFilteredTodos(): TodoItem[] {
        if (!this.filterPattern) {
            return this.todos;
        }

        // Check for @label syntax (exact label filter)
        if (this.filterPattern.startsWith('@')) {
            const labelFilter = this.filterPattern.slice(1);
            return this.todos.filter(todo => todo.label === labelFilter);
        }

        return this.todos.filter(todo => {
            const searchable = createSearchableString(todo.relativePath, todo.label, todo.text);
            return fuzzyMatch(searchable, this.filterPattern);
        });
    }

    getTreeItem(element: TodoTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TodoTreeItem): Thenable<TodoTreeItem[]> {
        const filteredTodos = this.getFilteredTodos();

        if (!element) {
            // Root level - depends on view mode
            if (this.viewMode === 'flat') {
                return Promise.resolve(this.getFlatItems(filteredTodos));
            } else {
                // Both 'grouped' and 'byTag' start with label groups
                return Promise.resolve(this.getLabelGroups(filteredTodos));
            }
        }

        if (element.nodeType === 'label' && element.todoLabel) {
            if (this.viewMode === 'byTag') {
                // In byTag mode, show TODOs flat under each label
                return Promise.resolve(this.getTodosForLabel(filteredTodos, element.todoLabel));
            } else {
                // In grouped mode, show files under each label
                return Promise.resolve(this.getFileGroups(filteredTodos, element.todoLabel));
            }
        }

        if (element.nodeType === 'file' && element.todoLabel && element.fileName) {
            // Get TODOs under this file within this label (only in grouped mode)
            return Promise.resolve(this.getTodosForFile(filteredTodos, element.todoLabel, element.fileName));
        }

        return Promise.resolve([]);
    }

    /**
     * Returns flat list of all TODOs, sorted by TODO text
     */
    private getFlatItems(todos: TodoItem[]): TodoTreeItem[] {
        return [...todos]
            .sort((a, b) => {
                // Sort by full TODO text (label + text)
                const aText = `TODO(${a.label}): ${a.text}`;
                const bText = `TODO(${b.label}): ${b.text}`;
                return aText.localeCompare(bText);
            })
            .map(todo => {
                const displayText = `TODO(${todo.label}): ${todo.text}`;
                return new TodoTreeItem(
                    displayText,
                    vscode.TreeItemCollapsibleState.None,
                    'todo',
                    todo
                );
            });
    }

    /**
     * Returns label groups at the root level
     */
    private getLabelGroups(todos: TodoItem[]): TodoTreeItem[] {
        // Group by label
        const labelMap = new Map<string, TodoItem[]>();

        for (const todo of todos) {
            const existing = labelMap.get(todo.label) || [];
            existing.push(todo);
            labelMap.set(todo.label, existing);
        }

        // Sort labels alphabetically
        const sortedLabels = [...labelMap.keys()].sort((a, b) => a.localeCompare(b));

        return sortedLabels.map(label => {
            const count = labelMap.get(label)!.length;
            return new TodoTreeItem(
                `${label} (${count})`,
                vscode.TreeItemCollapsibleState.Expanded,
                'label',
                undefined,
                label
            );
        });
    }

    /**
     * Returns file groups under a specific label
     */
    private getFileGroups(todos: TodoItem[], label: string): TodoTreeItem[] {
        // Filter to this label and group by file
        const labelTodos = todos.filter(t => t.label === label);
        const fileMap = new Map<string, TodoItem[]>();

        for (const todo of labelTodos) {
            const existing = fileMap.get(todo.relativePath) || [];
            existing.push(todo);
            fileMap.set(todo.relativePath, existing);
        }

        // Sort files alphabetically
        const sortedFiles = [...fileMap.keys()].sort((a, b) => a.localeCompare(b));

        return sortedFiles.map(fileName => {
            const count = fileMap.get(fileName)!.length;
            return new TodoTreeItem(
                `${fileName} (${count})`,
                vscode.TreeItemCollapsibleState.Expanded,
                'file',
                undefined,
                label,
                fileName
            );
        });
    }

    /**
     * Returns TODOs under a specific file within a specific label
     */
    private getTodosForFile(todos: TodoItem[], label: string, fileName: string): TodoTreeItem[] {
        return todos
            .filter(t => t.label === label && t.relativePath === fileName)
            .sort((a, b) => a.text.localeCompare(b.text))
            .map(todo => new TodoTreeItem(
                todo.text || '(empty)',
                vscode.TreeItemCollapsibleState.None,
                'todo',
                todo,
                label,
                fileName
            ));
    }

    /**
     * Returns TODOs flat under a specific label (for byTag view mode)
     */
    private getTodosForLabel(todos: TodoItem[], label: string): TodoTreeItem[] {
        return todos
            .filter(t => t.label === label)
            .sort((a, b) => a.text.localeCompare(b.text))
            .map(todo => new TodoTreeItem(
                todo.text || '(empty)',
                vscode.TreeItemCollapsibleState.None,
                'todo',
                todo,
                label
            ));
    }
}
