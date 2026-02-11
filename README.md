# just-todo-it

TODO viewer extension for Visual Studio Code.

<img src="https://raw.githubusercontent.com/alonrbar/just-todo-it/refs/heads/master/docs/assets/screenshot.png" alt="TODOs view" width="300" />

## TODO Format

The extension recognizes TODOs in the following format:

```
TODO: description text
TODO(label): description text
```

Examples:

```
// TODO: Refactor this function
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

# Build the extension
yarn build
```

## Debugging

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Press `F5` to launch an **Extension Development Host** window.

3. In the dev host, open any workspace and use the **Just TODO It** view to test changes.

4. For faster iteration, run TypeScript in watch mode in a terminal:

   ```bash
   yarn watch
   ```
