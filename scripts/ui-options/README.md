# UI preview options

These folders snapshot alternate versions of the collaboration main page so you can try them in isolation.

Each option mirrors the repository structure. The `preview-ui-option` script checks out a throwaway branch, copies the files over, and leaves the changes unstaged so you can explore the UI without touching your main branch.

## Available options

- `board`: the current dashboard-style draft with panels and quick actions
- `classic`: the earlier layout that keeps the original list-focused experience

You can add more options by creating a new folder next to these, mirroring the repo paths you want to override.

## Usage

Run the command from the `make-tune3-react` folder:

```bash
npm run preview:ui -- board
```

That command will:

1. Create (or refresh) the `preview/board` branch from your current branch.
2. Copy the files from `scripts/ui-options/board` into place.
3. Leave the changes unstaged so you can run `npm run dev` and inspect the UI.

When you are done previewing:

```bash
git switch <your-original-branch>
git branch -D preview/board  # optional cleanup
```

Run the same command with `classic` (or any other folder name) to try a different look.
