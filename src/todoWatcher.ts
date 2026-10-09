import * as vscode from 'vscode';
import { INCLUDE_PATTERN } from './scan/scanFilePatterns';
import { TodoScanner } from './scan/todoScanner';
import { TodoTreeProvider } from './view/todoTreeProvider';

/**
 * Delay for batching file changes, so bursts (e.g. "Save All" or a git checkout) cause a single update
 */
const UPDATE_DELAY_MS = 300;

/**
 * Watches the workspace for created, changed and deleted files and updates their TODOs in batches
 */
export class TodoWatcher implements vscode.Disposable {

    private readonly fileWatcher: vscode.FileSystemWatcher;
    private readonly deleteWatcher: vscode.FileSystemWatcher;
    private readonly changedFiles = new Map<string, vscode.Uri>();
    private readonly deletedPaths = new Set<string>();
    private updateTimer: ReturnType<typeof setTimeout> | undefined;
    private updating: Promise<void> = Promise.resolve();

    /**
     * @param scanner - Scanner used to check and scan changed files
     * @param treeProvider - Tree provider to update
     * @param onDidUpdate - Called after each batch of changes is applied
     */
    constructor(
        private readonly scanner: TodoScanner,
        private readonly treeProvider: TodoTreeProvider,
        private readonly onDidUpdate: () => void
    ) {
        // Also catches changes made outside VS Code (e.g. git checkout), and saves from VS Code itself
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(INCLUDE_PATTERN, false, false, true);
        this.fileWatcher.onDidCreate(uri => this.onFileChanged(uri));
        this.fileWatcher.onDidChange(uri => this.onFileChanged(uri));

        // Deleted folders don't match the include pattern, so deletes are watched separately
        this.deleteWatcher = vscode.workspace.createFileSystemWatcher('**/*', true, true, false);
        this.deleteWatcher.onDidDelete(uri => this.onFileDeleted(uri));
    }

    public dispose(): void {
        clearTimeout(this.updateTimer);
        this.fileWatcher.dispose();
        this.deleteWatcher.dispose();
    }

    //
    // Private methods
    //

    private onFileChanged(uri: vscode.Uri): void {
        if (!this.scanner.shouldScan(uri)) {
            return;
        }
        this.deletedPaths.delete(uri.fsPath);
        this.changedFiles.set(uri.fsPath, uri);
        this.scheduleUpdate();
    }

    private onFileDeleted(uri: vscode.Uri): void {
        // The URI may be a folder, so it's not filtered with shouldScan
        this.changedFiles.delete(uri.fsPath);
        this.deletedPaths.add(uri.fsPath);
        this.scheduleUpdate();
    }

    private scheduleUpdate(): void {
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => {
            // Run updates one after another so an older batch can't overwrite a newer one
            this.updating = this.updating.then(() => this.update());
        }, UPDATE_DELAY_MS);
    }

    private async update(): Promise<void> {
        const changedFiles = [...this.changedFiles.values()];
        const deletedPaths = [...this.deletedPaths];
        this.changedFiles.clear();
        this.deletedPaths.clear();

        try {
            const results = await this.scanner.scanFiles(changedFiles);
            const todosPerFile = new Map(changedFiles.map((uri, index) => [uri.fsPath, results[index]]));
            this.scanner.removeFiles(deletedPaths);
            this.treeProvider.updateFiles(todosPerFile, deletedPaths);
            this.onDidUpdate();
        } catch (error) {
            console.error('Error updating changed files:', error);
        }
    }
}
