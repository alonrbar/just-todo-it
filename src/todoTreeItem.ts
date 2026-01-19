import * as vscode from 'vscode';
import { TodoItem } from './types';

/**
 * Tree item representing a node in the TODO tree view
 */
export class TodoTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly nodeType: 'label' | 'file' | 'todo',
        public readonly todoItem?: TodoItem,
        public readonly todoLabel?: string,
        public readonly fileName?: string
    ) {
        super(label, collapsibleState);

        this.contextValue = nodeType;

        if (nodeType === 'todo' && todoItem) {
            this.tooltip = `${todoItem.relativePath}:${todoItem.line + 1}\n${todoItem.text}`;
            this.description = `${todoItem.relativePath}:${todoItem.line + 1}`;
            this.iconPath = new vscode.ThemeIcon('testing-passed-icon', new vscode.ThemeColor('charts.green'));

            // Make the item clickable to navigate to the file
            this.command = {
                command: 'just-todo-it.openTodo',
                title: 'Open TODO',
                arguments: [todoItem]
            };
        } else if (nodeType === 'label') {
            this.iconPath = new vscode.ThemeIcon('tag');
        } else if (nodeType === 'file' && fileName) {
            // Use resourceUri to get VS Code's file icon theme icons
            this.resourceUri = vscode.Uri.file(fileName);
            this.iconPath = vscode.ThemeIcon.File;
        }
    }
}