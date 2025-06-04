# Obsidian Plugin Publishing Script

This directory contains a script for publishing the Discourse Graph Obsidian plugin with support for different release types and automated BRAT (Beta Reviewers Auto-update Tool) compatibility.

## Files

- `publish-obsidian.ts` - TypeScript script that handles the publishing process
- `README.md` - This documentation file

## Prerequisites

1. **Node.js and npm** - Ensure you have Node.js 18+ installed
2. **Git** - For repository operations
3. **GitHub Token** - For authentication (see Authentication section)

## Release Types

The script supports different release types based on version format and flags:

### Internal vs External Releases

**🔒 Internal Releases**
- **Format**: Non-standard SemVer (e.g., `0.1.0-canvas-integration`, `0.2.0-graph-refactor`)
- **Purpose**: Internal testing and development. These releases won't be recognized by BRAT as the latest version, hence won't be automatically updated on non-testers users. We also mark these releases as pre-release by default, so users will less likely install these.

   Developers can run this script from their local branch, creating an update release containing their local code.
- **BRAT Behavior**: Not auto-updated (users must install manually via specific version)
- **Main Branch**: Never updated (keeps production code clean)
- **Use Case**: Feature testing, experimental builds

**🌐 External Releases**
- **Format**: Valid SemVer (e.g., `1.0.0`, `1.0.0-beta.1`, `1.0.0-alpha.2`)
- **Purpose**: Public testing and distribution

   Note: should only be ran from main branch, after having merged the feature
- **BRAT Behavior**: Auto-updated for users with "latest" version setting
- **Main Branch**: Updated only for stable releases
- **Use Case**: Beta testing, production releases

### Pre-release vs Stable

**🧪 Pre-release** (default behavior)
- **GitHub**: Marked as "Pre-release" 
- **Main Branch**: Not updated (keeps stable code in main)
- **Use Case**: Testing, beta versions, internal releases

**✅ Stable** (with `--stable` flag)
- **GitHub**: Marked as stable release
- **Main Branch**: Updated with new version (for official Obsidian store)
- **Use Case**: Production-ready releases

## Authentication

You need a GitHub token with appropriate permissions to push to the target repository and create releases.

### Setting up the token

Grab the token from 1Password's Engineering vault, in "obsidian .env"

### Providing the token


Create a `.env` file in the `apps/obsidian/` folder:

```env
OBSIDIAN_PLUGIN_REPO_TOKEN=your_token_here
```

## Usage

### Basic Command Structure

```bash
tsx scripts/publish-obsidian.ts --version <version> [options]
```

### Required Arguments

- `--version, -v <version>` - Version to publish

### Optional Arguments

- `--create-release, -r` - Create a GitHub release
- `--stable` - Mark as stable release. This will signal to users that it's an official update, and also updates main branch
- `--release-name <name>` - Custom release name (defaults to "Discourse Graph v{version}")
- `--help, -h` - Show help message

### Version Formats

| Format | Type | BRAT Auto-Update | Main Branch Update | Example |
|--------|------|------------------|-------------------|---------|
| `x.y.z-feature-name` | Internal | ❌ No | ❌ Never | `0.1.0-canvas-integration` |
| `x.y.z-beta.n` | External Pre-release | ✅ Yes | ❌ No | `1.0.0-beta.1` |
| `x.y.z-alpha.n` | External Pre-release | ✅ Yes | ❌ No | `1.0.0-alpha.2` |
| `x.y.z` (with `--stable`) | External Stable | ✅ Yes | ✅ Yes | `1.0.0` |

## Examples

### Internal Testing Release
```bash
# Creates pre-release, no main branch update, manual BRAT install only
tsx scripts/publish-obsidian.ts --version 0.1.0-canvas-feature --release-name "Canvas Integration Feature" --create-release
```

### Beta Release for Public Testing  
```bash
# Creates pre-release, no main branch update, BRAT auto-updates
tsx scripts/publish-obsidian.ts --version 1.0.0-beta.1 --release-name "Beta: New Graph View" --create-release
```

### Stable Production Release
```bash
# Creates stable release, updates main branch, BRAT auto-updates
tsx scripts/publish-obsidian.ts --version 1.0.0 --stable --create-release
```

### Quick Build (No GitHub Release)
```bash
# For when we only want to update the repo without creating a release
tsx scripts/publish-obsidian.ts --version 0.1.0-beta-1 --stable
```

### Using npm script from obsidian directory
```bash
cd apps/obsidian
npm run publish -- --version 1.0.0-beta.1 --create-release
```

## What the Script Does

### For All Releases:
1. **Validates input** - Checks version format and arguments
2. **Detects release type** - Internal vs External based on SemVer validation
3. **Builds the plugin** - Runs `npm run build` to create distribution files
4. **Copies source files** - Copies plugin source (excluding build artifacts)

### For External Stable Releases Only:
5. **Updates main branch** - Creates proper git commit via GitHub API with:
   - Updated `manifest.json` with new version
   - Built `main.js`, `styles.css`
   - All other source files

### If `--create-release` flag is used:
6. **Creates GitHub release** with:
   - Custom or default release name
   - Pre-release or stable marking
   - Required assets: `main.js`, `manifest.json`, `styles.css`

## File Operations

### Excluded Files (never published):
- `node_modules/`
- `dist/`
- `.env*` files
- `.turbo/`
- `.DS_Store`
- Log files (`*.log`)
- Git files (`.git/`)

### Required Build Files:
- `main.js` - Compiled plugin code
- `manifest.json` - Plugin manifest with version
- `styles.css` - Plugin styles

## Target Repository

Publishes to: `DiscourseGraphs/discourse-graph-obsidian`

### Repository State by Release Type:

**Internal Release**: Repository unchanged, only GitHub release created
**External Pre-release**: Repository unchanged, GitHub release created  
**External Stable**: Repository main branch updated + GitHub release created

## Troubleshooting

### Common Issues

1. **"Version is required"**
   ```bash
   # ❌ Wrong
   tsx scripts/publish-obsidian.ts --create-release
   
   # ✅ Correct  
   tsx scripts/publish-obsidian.ts --version 1.0.0 --create-release
   ```

2. **"Invalid version format"**
   ```bash
   # ❌ Wrong
   tsx scripts/publish-obsidian.ts --version "beta-1"
   
   # ✅ Correct
   tsx scripts/publish-obsidian.ts --version 1.0.0-beta.1
   ```

3. **"OBSIDIAN_PLUGIN_REPO_TOKEN environment variable is required"**
   - Set the token in environment variables or `.env` file
   - Verify token has repository write permissions

4. **"Failed to update main branch"**
   - Usually occurs with external stable releases
   - Check token permissions
   - Verify repository exists and is accessible

5. **"Required build files missing"**
   - Run `npm run build` manually to check for build errors
   - Ensure TypeScript compiles without errors

### BRAT Testing

To test BRAT integration:

1. **Internal Release**: Users must install via specific version tag
2. **External Release**: Users with "latest" setting will auto-update

## Development Notes

### Key Functions:
- `isExternalRelease()` - Validates SemVer format
- `updateMainBranch()` - Uses GitHub API to create proper commits  
- `createGithubRelease()` - Creates releases with assets
- `updateManifest()` - Updates version in manifest.json

### Security:
- Uses GitHub API instead of git commands for better security
- Never commits tokens to repository