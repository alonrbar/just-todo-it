import * as vscode from 'vscode';

/**
 * Provides a webview with a search input for filtering TODOs
 */
export class SearchViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'todoSearchView';

    private _view?: vscode.WebviewView;
    private _currentQuery: string = '';

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _onSearch: (query: string) => void
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'search':
                    this._currentQuery = message.query;
                    this._onSearch(message.query);
                    break;
                case 'clear':
                    this._currentQuery = '';
                    this._onSearch('');
                    break;
            }
        });

        // Restore previous query when view becomes visible again
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible && this._currentQuery) {
                this._view?.webview.postMessage({ 
                    type: 'setQuery', 
                    query: this._currentQuery 
                });
            }
        });
    }

    /**
     * Clears the search input and filter
     */
    public clearSearch(): void {
        this._currentQuery = '';
        this._onSearch('');
        this._view?.webview.postMessage({ type: 'setQuery', query: '' });
    }

    /**
     * Sets the search query programmatically
     */
    public setQuery(query: string): void {
        this._currentQuery = query;
        this._view?.webview.postMessage({ type: 'setQuery', query });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            padding: 0 8px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        .search-container {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        #searchInput {
            flex: 1;
            padding: 4px 8px;
            border: 1px solid var(--vscode-input-border, transparent);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
            outline: none;
            font-size: var(--vscode-font-size);
        }
        #searchInput:focus {
            border-color: var(--vscode-focusBorder);
        }
        #searchInput::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }
        #clearButton {
            background: transparent;
            border: none;
            color: var(--vscode-icon-foreground);
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 2px;
            opacity: 0.7;
        }
        #clearButton:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
            opacity: 1;
        }
        #clearButton.hidden {
            visibility: hidden;
        }
        .hint {
            margin-top: 6px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="search-container">
        <input type="text" id="searchInput" placeholder="Filter TODOs..." autocomplete="off" spellcheck="false">
        <button id="clearButton" class="hidden" title="Clear search">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/>
            </svg>
        </button>
    </div>
    <div class="hint">Search TODOs by path, label, or text</div>
    <script>
        const vscode = acquireVsCodeApi();
        const input = document.getElementById('searchInput');
        const clearButton = document.getElementById('clearButton');
        
        let debounceTimer;
        
        function updateClearButton() {
            if (input.value) {
                clearButton.classList.remove('hidden');
            } else {
                clearButton.classList.add('hidden');
            }
        }
        
        input.addEventListener('input', () => {
            updateClearButton();
            
            // Debounce the search
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                vscode.postMessage({ type: 'search', query: input.value });
            }, 150);
        });
        
        clearButton.addEventListener('click', () => {
            input.value = '';
            updateClearButton();
            vscode.postMessage({ type: 'clear' });
            input.focus();
        });
        
        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'setQuery') {
                input.value = message.query;
                updateClearButton();
            }
        });
        
        // Focus input on load
        input.focus();
    </script>
</body>
</html>`;
    }
}
