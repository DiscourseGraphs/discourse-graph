# Documentation Guide: Adding and Editing Plugin Documentation

This guide explains how to add and edit documentation for the Discourse Graph project, specifically for the plugins (Roam and Obsidian). The documentation is hosted on our website at [discoursegraphs.com](https://discoursegraphs.com) and is built using Next.js with markdown files.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [For Non-Technical Users](#for-non-technical-users)
- [For Technical Users](#for-technical-users)
- [Documentation Structure](#documentation-structure)
- [Adding New Documentation](#adding-new-documentation)
- [Editing Existing Documentation](#editing-existing-documentation)
- [Adding Images and Assets](#adding-images-and-assets)
- [Updating Navigation](#updating-navigation)
- [Testing Changes](#testing-changes)
- [Deployment](#deployment)
- [Best Practices](#best-practices)

## 🚀 Quick Start

The documentation lives in the repository and requires you to:

1. **Fork or clone** the repository
2. **Edit markdown files** in `apps/website/app/(docs)/docs/roam/pages/`
3. **Add images** to `apps/website/public/docs/roam/`
4. **Update navigation** in `apps/website/app/(docs)/docs/roam/navigation.ts`
5. **Submit a pull request** with your changes

## 👤 For Non-Technical Users

### Option 1: GitHub Web Interface (Recommended)

You can edit documentation directly through GitHub's web interface without installing anything:

1. **Navigate to the repository** on GitHub
2. **Browse to the documentation file** you want to edit:
   - Go to `apps/website/app/(docs)/docs/roam/pages/`
   - Click on the `.md` file you want to edit
3. **Click the pencil icon** (Edit this file) in the top right
4. **Make your changes** using GitHub's markdown editor
5. **Scroll down** and add a commit message describing your changes
6. **Click "Propose changes"** to create a pull request

### Option 2: Download and Edit Locally

1. **Download the repository** as a ZIP file from GitHub
2. **Extract the files** to your computer
3. **Find the documentation files** in `apps/website/app/(docs)/docs/roam/pages/`
4. **Edit the `.md` files** with any text editor (like Notepad++, VS Code, or even Notepad)
5. **Save your changes**
6. **Upload changed files** back to GitHub or send them to a technical team member

### Working with Markdown

Documentation files use Markdown format. Here's a quick reference:

```markdown
# Main Heading
## Section Heading
### Subsection Heading

**Bold text**
*Italic text*

- Bullet point
- Another bullet point

1. Numbered list
2. Another item

[Link text](https://example.com)

![Image alt text](image-filename.png)

`Code text`

```
Code block
```
```

## 👨‍💻 For Technical Users

### Prerequisites

- Node.js 18+ and npm/yarn
- Git

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd <repository-name>
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** to `http://localhost:3000/docs/roam`

### Making Changes

1. **Create a new branch**:
   ```bash
   git checkout -b docs/your-feature-name
   ```

2. **Make your changes** (see sections below)

3. **Test locally** by running the dev server

4. **Commit and push**:
   ```bash
   git add .
   git commit -m "docs: description of changes"
   git push origin docs/your-feature-name
   ```

5. **Create a pull request** on GitHub

## 📁 Documentation Structure

```
apps/website/
├── app/(docs)/docs/roam/
│   ├── pages/                    # 📄 Markdown documentation files
│   │   ├── getting-started.md
│   │   ├── installation.md
│   │   └── ...
│   ├── navigation.ts            # 🗺️ Navigation menu configuration
│   ├── layout.tsx               # 🎨 Documentation layout
│   └── [slug]/page.tsx          # ⚙️ Dynamic page renderer
└── public/docs/roam/            # 🖼️ Images and assets
    ├── screenshot1.png
    ├── diagram.gif
    └── ...
```

## ➕ Adding New Documentation

### 1. Create the Markdown File

Create a new `.md` file in `apps/website/app/(docs)/docs/roam/pages/`:

```markdown
---
title: "Your Page Title"
date: "2025-01-01"
author: "Your Name"
published: true
---

# Your Page Title

Your content here...
```

### 2. File Naming Convention

- Use lowercase letters
- Use hyphens instead of spaces
- Use descriptive names
- Example: `advanced-querying-techniques.md`

### 3. Required Frontmatter

Every documentation file must have this frontmatter at the top:

```markdown
---
title: "Display Title"           # Required: Shows in navigation and page header
date: "YYYY-MM-DD"              # Required: Creation or last update date
author: "Author Name"            # Optional: Can be empty string
published: true                  # Required: Must be true for page to appear
---
```

### 4. Add to Navigation

Edit `apps/website/app/(docs)/docs/roam/navigation.ts`:

```typescript
// Find the appropriate section and add your link
{
  title: "🗺️ GUIDES",
  links: [
    // ... existing links
    {
      title: "Your New Page Title",
      href: `${ROOT}/your-new-page-filename`,
    },
  ],
},
```

## ✏️ Editing Existing Documentation

1. **Find the file** in `apps/website/app/(docs)/docs/roam/pages/`
2. **Edit the markdown content** while preserving the frontmatter
3. **Update the `date` field** in the frontmatter to reflect your changes
4. **Save the file**

## 🖼️ Adding Images and Assets

### 1. Add Image Files

Place image files in `apps/website/public/docs/roam/`:

```
apps/website/public/docs/roam/
├── your-screenshot.png
├── your-diagram.gif
└── your-illustration.jpg
```

### 2. Reference Images in Markdown

Use relative paths from the `/docs/roam/` directory:

```markdown
![Alt text description](/docs/roam/your-screenshot.png)
```

### 3. Image Best Practices

- **Use descriptive filenames**: `query-drawer-advanced.png` instead of `img1.png`
- **Optimize file sizes**: Compress images before adding them
- **Use appropriate formats**: PNG for screenshots, GIF for animations, JPG for photos
- **Add alt text**: Always provide descriptive alt text for accessibility

## 🗺️ Updating Navigation

The navigation menu is configured in `apps/website/app/(docs)/docs/roam/navigation.ts`.

### Structure

```typescript
export const navigation: NavigationList = [
  {
    title: "🏠 Welcome!",           // Section title with emoji
    links: [
      { 
        title: "Getting Started",   // Link text
        href: `${ROOT}/getting-started` // URL path
      },
      // ... more links
    ],
  },
  // ... more sections
];
```

### Adding New Sections

```typescript
{
  title: "🔧 ADVANCED TOPICS",
  links: [
    {
      title: "Custom Configurations",
      href: `${ROOT}/custom-configurations`,
    },
    {
      title: "API Integration",
      href: `${ROOT}/api-integration`,
    },
  ],
},
```

### Reordering Items

Simply drag and drop the objects within the arrays to reorder navigation items.

## 🧪 Testing Changes

### For Technical Users

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to your documentation** at `http://localhost:3000/docs/roam`

3. **Check that your page appears** in the navigation and renders correctly

4. **Test all links and images** work properly

### For Non-Technical Users

After making changes through GitHub's web interface, you can:

1. **Wait for the automatic deployment** (usually takes 5-10 minutes)
2. **Check the live site** at discoursegraphs.com
3. **Ask a technical team member** to review your changes

## 🚀 Deployment

### Automatic Deployment

- Changes to the `main` branch automatically deploy to production
- Pull requests create preview deployments for testing

### Manual Deployment (Technical Users)

If you have deployment access:

```bash
npm run build
npm run start
```

## 📝 Best Practices

### Writing Guidelines

1. **Use clear, descriptive headings** that follow a logical hierarchy
2. **Write in a conversational tone** that's accessible to all skill levels
3. **Include plenty of examples** and code snippets
4. **Add screenshots** for visual features and complex UI interactions
5. **Link to related documentation** to help users navigate
6. **Keep paragraphs short** and use bullet points for lists

### Technical Guidelines

1. **Always test locally** before submitting changes
2. **Use semantic commit messages**: `docs: add installation guide`
3. **Include both technical and non-technical explanations** when appropriate
4. **Keep images under 1MB** when possible
5. **Use consistent formatting** throughout all documentation

### Content Guidelines

1. **Start with the user's goal** - what are they trying to accomplish?
2. **Provide step-by-step instructions** with clear actions
3. **Include troubleshooting sections** for common issues
4. **Add "Next Steps" or "See Also" sections** to guide users further
5. **Keep content up-to-date** with the latest plugin versions

## 🆘 Getting Help

If you need help with documentation:

1. **Check existing documentation** for similar examples
2. **Ask in the project's Discord/Slack** (if available)
3. **Open an issue** on GitHub with your question
4. **Reach out to the development team** for technical assistance

## 📋 Checklist for New Documentation

Before submitting new documentation, ensure you have:

- [ ] Created the markdown file with proper frontmatter
- [ ] Added the page to the navigation menu
- [ ] Included all necessary images in the public directory
- [ ] Used proper markdown formatting and syntax
- [ ] Tested all links and image references
- [ ] Proofread for spelling and grammar
- [ ] Followed the established writing style and tone
- [ ] Added appropriate cross-references to related topics

---

**Need help?** Don't hesitate to ask questions or request assistance from the development team. Good documentation benefits everyone! 🎉