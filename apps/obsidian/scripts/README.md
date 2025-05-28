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
export GITHUB_TOKEN="your_token_here"
# or
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
- `--target-repo <repo>` - Target repository (overrides environment variable)
- `--stable` - Mark as stable release (not pre-release)
- `--help, -h` - Show help message

### Examples

```bash
# Basic publish without release
tsx scripts/publish-obsidian.ts --version 0.1.0-beta.1

# Publish with GitHub release
tsx scripts/publish-obsidian.ts --version 0.1.0-beta.1 --create-release

# Publish stable release
tsx scripts/publish-obsidian.ts --version 1.0.0 --create-release --stable

# Custom target repository
tsx scripts/publish-obsidian.ts --version 0.2.0 --target-repo "YourOrg/your-plugin"

# Using npm script from obsidian directory
cd apps/obsidian
npm run publish -- --version 0.1.0-beta.1 --create-release
```

### Environment Variables

The script uses environment variables for configuration:

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `GITHUB_TOKEN` or `OBSIDIAN_PLUGIN_REPO_TOKEN` | **required** | GitHub token for authentication |
| `OBSIDIAN_TARGET_REPO` | `DiscourseGraphs/discourse-graph-obsidian` | Default target repository |
| `OBSIDIAN_IS_PRERELEASE` | `true` | Default pre-release setting |

### Using .env file

Create a `.env` file in the root directory:

```env
GITHUB_TOKEN=your_token_here
OBSIDIAN_TARGET_REPO=DiscourseGraphs/discourse-graph-obsidian
OBSIDIAN_IS_PRERELEASE=true
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
   - `manifest.json` (required, with updated version)
   - `styles.css` (optional)
5. **Updates manifest** - Sets the version and ensures compatible plugin ID
6. **Pushes to repository** - Force pushes to the target repository's main branch
7. **Creates release** (if `--create-release` flag is used) - Creates a GitHub release with:
   - Individual files: `main.js`, `manifest.json`, `styles.css`
   - Complete zip archive: `discourse-graph-v{version}.zip`

## Target Repository Structure

The script publishes to a separate repository that contains only the plugin files needed for Obsidian. This repository should be structured as:

```
discourse-graph-obsidian/
├── main.js              # Built plugin code
├── manifest.json        # Plugin manifest with updated version
├── styles.css           # Plugin styles (if any)
├── README.md            # Plugin documentation
├── docs/                # Documentation files
└── ...                  # Other source files (excluding build artifacts)
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
   - Ensure the target repository exists and you have write access

5. **"Release creation failed"**
   - Verify the repository exists and you have release permissions
   - Check that your GitHub token has the necessary permissions
   - Make sure you used the `--create-release` flag

6. **"apps/obsidian directory not found"**
   - Make sure you're running the script from the root of the discourse-graph repository

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
- **Repository operations**: Modify `pushToRepository()` function
- **Release creation**: Update `createRelease()` function

### Testing

Before publishing to the main repository, you can test the script with a different target repository:

```bash
tsx scripts/publish-obsidian.ts \
  --version 0.0.1-test \
  --target-repo "YourUsername/test-repo" \
  --create-release
```

## Security Notes

- Never commit GitHub tokens to the repository
- Use environment variables or `.env` files (which should be gitignored)
- The script force-pushes to the target repository, which overwrites history
- Ensure you have backups of important data in the target repository

## Comparison with GitHub Workflow

This script replaces the GitHub workflow approach with a local script that:
- Can be run from any environment with Node.js
- Requires explicit version input for safety
- Uses command line flags for key options
- Provides immediate feedback and debugging
- Follows a similar pattern to other publishing tools 