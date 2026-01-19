import * as vscode from 'vscode';
import { TodoScanner } from './todoScanner';
import { TodoTreeProvider } from './todoTreeProvider';
import { SearchViewProvider } from './searchViewProvider';
import { TodoItem } from './types';

let treeView: vscode.TreeView<any>;
let searchViewProvider: SearchViewProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Just TODO It extension is now active');

    const scanner = new TodoScanner();
    const treeProvider = new TodoTreeProvider();

    // Create the search view provider
    searchViewProvider = new SearchViewProvider(context.extensionUri, (query) => {
        treeProvider.setFilter(query);
        updateTreeViewTitle(treeProvider);
    });

    // Register the search webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SearchViewProvider.viewType,
            searchViewProvider
        )
    );

    // Create the tree view
    treeView = vscode.window.createTreeView('todoTreeView', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });

    // Initial scan
    scanWorkspace(scanner, treeProvider);

    // Register commands
    const refreshCommand = vscode.commands.registerCommand('just-todo-it.refresh', async () => {
        await scanWorkspace(scanner, treeProvider);
    });

    const toggleFlatCommand = vscode.commands.registerCommand('just-todo-it.toggleFlat', () => {
        treeProvider.toggleViewMode();
    });

    const searchCommand = vscode.commands.registerCommand('just-todo-it.search', async () => {
        const currentFilter = treeProvider.getFilter();
        const input = await vscode.window.showInputBox({
            prompt: 'Filter TODOs (fuzzy match on file path, label, and text)',
            value: currentFilter,
            placeHolder: 'Type to filter...'
        });

        if (input !== undefined) {
            treeProvider.setFilter(input);
            searchViewProvider.setQuery(input);
            updateTreeViewTitle(treeProvider);
        }
    });

    const clearSearchCommand = vscode.commands.registerCommand('just-todo-it.clearSearch', () => {
        treeProvider.setFilter('');
        searchViewProvider.clearSearch();
        updateTreeViewTitle(treeProvider);
    });

    const scopeToLabelCommand = vscode.commands.registerCommand('just-todo-it.scopeToLabel', (item: any) => {
        if (item && item.todoLabel) {
            const labelFilter = `@${item.todoLabel}`;
            treeProvider.setFilter(labelFilter);
            searchViewProvider.setQuery(labelFilter);
            updateTreeViewTitle(treeProvider);
        }
    });

    const openTodoCommand = vscode.commands.registerCommand('just-todo-it.openTodo', async (todo: TodoItem) => {
        const uri = vscode.Uri.file(todo.filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);
        
        // Move cursor to the TODO line
        const position = new vscode.Position(todo.line, todo.column);
        const selection = new vscode.Selection(position, position);
        editor.selection = selection;
        editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
    });

    // Set up file watcher to auto-refresh on file save
    const fileWatcher = vscode.workspace.onDidSaveTextDocument((document) => {
        scanDocument(scanner, treeProvider, document);
    });

    // Watch for file creation and deletion
    const createWatcher = vscode.workspace.onDidCreateFiles(async (event: vscode.FileCreateEvent) => {
        for (const file of event.files) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                scanDocument(scanner, treeProvider, document);
            } catch (error) {
                console.warn(`Could not scan created file ${file.fsPath}:`, error);
            }
        }
    });

    const deleteWatcher = vscode.workspace.onDidDeleteFiles((event: vscode.FileDeleteEvent) => {
        for (const file of event.files) {
            // File is deleted, so just remove its TODOs (pass empty array)
            treeProvider.setTodosForFile(file.fsPath, []);
        }
        updateTreeViewTitle(treeProvider);
    });

    // Register all disposables
    context.subscriptions.push(
        treeView,
        refreshCommand,
        toggleFlatCommand,
        searchCommand,
        clearSearchCommand,
        scopeToLabelCommand,
        openTodoCommand,
        fileWatcher,
        createWatcher,
        deleteWatcher
    );
}

/**
 * Scans the entire workspace and updates the tree provider
 */
async function scanWorkspace(scanner: TodoScanner, treeProvider: TodoTreeProvider): Promise<void> {
    try {
        const todos = await scanner.scanWorkspace();
        treeProvider.setTodos(todos);
        updateTreeViewTitle(treeProvider);
    } catch (error) {
        console.error('Error scanning workspace:', error);
        vscode.window.showErrorMessage('Failed to scan workspace for TODOs');
    }
}

/**
 * Scans a single document and updates the tree provider
 */
function scanDocument(scanner: TodoScanner, treeProvider: TodoTreeProvider, document: vscode.TextDocument): void {
    try {
        const todos = scanner.scanDocument(document);
        treeProvider.setTodosForFile(document.uri.fsPath, todos);
        updateTreeViewTitle(treeProvider);
    } catch (error) {
        console.error('Error scanning document:', error);
    }
}

/**
 * Updates the tree view title/description based on current state
 */
function updateTreeViewTitle(treeProvider: TodoTreeProvider): void {
    const filter = treeProvider.getFilter();
    const todos = treeProvider.getTodos();
    
    if (filter) {
        treeView.description = `Filtering: "${filter}"`;
    } else {
        treeView.description = `${todos.length} TODO${todos.length === 1 ? '' : 's'}`;
    }
}

export function deactivate() {
    console.log('Just TODO It extension is now deactivated');
}
