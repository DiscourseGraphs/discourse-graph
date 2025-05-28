# Obsidian Plugin Publishing Script

This directory contains a script for publishing the Discourse Graph Obsidian plugin to the target repository.

## Files

- `publish-obsidian.ts` - TypeScript script that handles the publishing process
- `README.md` - This documentation file

## Prerequisites

1. **Node.js and npm** - Ensure you have Node.js 18+ installed
2. **Git** - For repository operations
3. **GitHub Token** - For authentication (see Authentication section)

## Authentication

You need a GitHub token with appropriate permissions to push to the target repository and create releases.

### Setting up the token

1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Create a new token with these permissions:
   - `repo` (full repository access)
   - `workflow` (if you need to trigger workflows)

### Providing the token

Set the token as an environment variable:

```bash
export OBSIDIAN_PLUGIN_REPO_TOKEN="your_token_here"
```

## Usage

### Command Line Arguments

The script requires a version to be specified via command line arguments:

```bash
tsx scripts/publish-obsidian.ts --version <version> [options]
```

#### Required Arguments

- `--version, -v <version>` - Version to publish (e.g., 0.1.0-beta.1)

#### Options

- `--create-release, -r` - Create a GitHub release
- `--stable` - Mark as stable release (defaults to pre-release if not specified)
- `--help, -h` - Show help message

### Examples

```bash
# Basic publish without release (pre-release)
tsx scripts/publish-obsidian.ts --version 0.1.0-beta.1

# Publish with GitHub release (pre-release)
tsx scripts/publish-obsidian.ts --version 0.1.0-beta.1 --create-release

# Publish stable release
tsx scripts/publish-obsidian.ts --version 1.0.0 --create-release --stable

# Using npm script from obsidian directory
cd apps/obsidian
npm run publish -- --version 0.1.0-beta.1 --create-release
```

### Environment Variables

The script uses the following environment variable:

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `OBSIDIAN_PLUGIN_REPO_TOKEN` | **required** | GitHub token for authentication |

### Using .env file

Create a `.env` file in the root directory:

```env
OBSIDIAN_PLUGIN_REPO_TOKEN=your_token_here
```

## What the Script Does

1. **Validates input** - Checks version format and required arguments
2. **Builds the plugin** - Runs `npm run build` in the obsidian app directory
3. **Copies source files** - Copies all files from `apps/obsidian` excluding:
   - `node_modules`
   - `dist`
   - `.env*` files
   - `.turbo`
   - `.DS_Store`
   - Log files
   - Other gitignored files
4. **Copies build artifacts** - Overwrites with built files:
   - `main.js` (required)
   - `manifest.json` (required)
   - `styles.css` (required)
5. **Updates manifest** - Sets the version and ensures compatible plugin ID
6. **Pushes to repository** - Force pushes to the target repository's main branch
7. **Creates release** (if `--create-release` flag is used) - Creates a GitHub release with:
   - Individual files: `main.js`, `manifest.json`, `styles.css`
   - Complete zip archive: `discourse-graph-v{version}.zip`

## Target Repository Structure

The script publishes to `DiscourseGraphs/discourse-graph-obsidian` repository that contains only the plugin files needed for Obsidian. This repository should be structured as:

```
discourse-graph-obsidian/
├── main.js              # Built plugin code
├── manifest.json        # Plugin manifest with updated version
├── styles.css          # Plugin styles
├── README.md           # Plugin documentation
├── docs/               # Documentation files
└── ...                 # Other source files (excluding build artifacts)
```

## Troubleshooting

### Common Issues

1. **"Version is required"**
   - Make sure to provide the `--version` argument
   - Use `--help` to see usage information

2. **"Invalid version format"**
   - Version must follow semver format: `x.y.z` or `x.y.z-suffix`
   - Examples: `1.0.0`, `0.1.0-beta.1`, `2.1.3-alpha.2`

3. **"Build failed"**
   - Ensure all dependencies are installed: `npm install`
   - Check for TypeScript errors in the obsidian app
   - Verify the build script works: `cd apps/obsidian && npm run build`

4. **"Authentication failed"**
   - Verify your GitHub token has the correct permissions
   - Check that the token is properly set in environment variables
   - Ensure you have write access to the repository

5. **"Release creation failed"**
   - Verify you have release permissions
   - Check that your GitHub token has the necessary permissions
   - Make sure you used the `--create-release` flag

### Debug Mode

The script outputs detailed information about each step, including:
- Configuration summary
- Build progress
- File copying details
- Git operations
- Release creation status

## Development

### Modifying the Script

The main logic is in `publish-obsidian.ts`. Key areas:

- **Argument parsing**: Modify `parseArgs()` function
- **File exclusion**: Modify `EXCLUDE_PATTERNS` array
- **Build process**: Update `buildPlugin()` function
- **Repository operations**: Modify `pushToRepo()` function
- **Release creation**: Update `createGithubRelease()` function

### Testing

Before making changes, you can test the script with a test version:

```bash
tsx scripts/publish-obsidian.ts --version 0.0.1-test --create-release
```

## Security Notes

- Never commit GitHub tokens to the repository
- Use environment variables or `.env` files (which should be gitignored)
- The script force-pushes to the target repository, which overwrites history
- Ensure you have backups of important data in the target repository 