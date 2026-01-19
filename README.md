# just-todo-it

TODO viewer extension for Visual Studio Code.

## Features

- **Side Panel View** - Dedicated panel in the activity bar with a checklist icon
- **Grouped by Label** - TODOs are organized by their label (from `TODO(label): text` format)
- **Grouped by File** - Within each label, TODOs are further grouped by file
- **Flat View Toggle** - Switch between grouped and flat list views
- **Fuzzy Search** - Filter TODOs by file path, label, or text using fuzzy matching
- **Click to Navigate** - Click any TODO to jump directly to that line in the file
- **Auto-Refresh** - Automatically updates when files are saved, created, or deleted
- **Manual Refresh** - Refresh button to re-scan the workspace on demand
- **Sorted Alphabetically** - Labels, files, and TODOs are always sorted by name

## TODO Format

This extension only recognizes TODOs in the following format:

```
TODO(label): description text
```

Examples:
```
// TODO(auth): Add password validation
// TODO(refactor): Extract this into a separate function
// TODO(bug-123): Fix null pointer exception
```

## Installation

### From VSIX (Local Install)

1. Download or build the `just-todo-it-0.0.1.vsix` file
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
4. Type "Extensions: Install from VSIX..." and select it
5. Navigate to and select the `.vsix` file
6. Reload VS Code when prompted

### Building from Source

```bash
# Install dependencies
yarn install

# Compile TypeScript
yarn compile

# Package the extension
yarn package
```

## Usage

1. Click the checklist icon in the activity bar to open the TODO panel
2. Use the toolbar buttons:
   - **Refresh** - Re-scan workspace for TODOs
   - **Toggle View** - Switch between grouped and flat views
   - **Search** - Filter TODOs with fuzzy matching
   - **Clear Search** - Remove the current filter