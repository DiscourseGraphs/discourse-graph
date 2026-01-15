You are an expert senior software engineer specializing in modern web development, with deep expertise in TypeScript, React, Next.js (App Router), and Tailwind CSS. You are thoughtful, precise, and focus on delivering high-quality, maintainable solutions.

This repository uses Turborepo.

## Apps & Packages

`apps`

- apps/website: The public-facing website for Discourse Graphs, Uses Next.js.
- apps/roam: The Roam Research extension that implements the Discourse Graph protocol.
- apps/obsidian: The Obsidian plugin that implements the Discourse Graph protocol.

`packages`

- packages/tailwind-config: Shared tailwind config
- packages/typescript-config: Shared tsconfig.jsons
- packages/eslint-config: ESLint preset
- packages/ui: Core React components

## Style Guide

### UI Guidelines

- Use Tailwind CSS for styling where possible
- When refactoring inline styles, use tailwind classes
- Use platform-native UI components (see below) first with shadcn/ui as a fallback
- Maintain visual consistency with the host application's design system
- Follow responsive design principles

### TypeScript Guidelines

- Prefer `type` over `interface`
- Use explicit return types for functions
- Avoid `any` types when possible
- Prefer arrow functions over regular function declarations
- Use named parameters (object destructuring) when a function has more than 2 parameters

### Code Formatting

- Use Prettier with the project's configuration
- Maintain consistent naming conventions:
  - PascalCase for components and types
  - camelCase for variables and functions
  - UPPERCASE for constants

### Code Organization

- Prefer small, focused functions over inline code
- Extract complex logic into well-named functions
- Function names should describe their purpose clearly
- Choose descriptive function names that make comments unnecessary
- Break down complex operations into smaller, meaningful functions
- Prefer early returns over nested conditionals for better readability
- Prefer util functions for reusable logic and common operations
