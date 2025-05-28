# Style Guide

This document outlines the coding standards and best practices for contributing to Discourse Graphs.

## TypeScript Guidelines

- Prefer `type` over `interface`
- Use explicit return types for functions
- Avoid `any` types when possible
- Prefer arrow functions over regular function declarations

## UI Guidelines

- Use [Tailwind CSS](https://tailwindcss.com/) for styling where possible
- Use platform-native UI components first ([blueprintjs for Roam](https://roamresearch.com/#/app/developer-documentation/page/5BB8h4I7b), [Lucide icons for Obsidian](https://help.obsidian.md/Contributing+to+Obsidian/Style+guide), etc), with [shadcn/ui](https://ui.shadcn.com/) as a fallback
- Maintain visual consistency with the host application's design system
- Follow responsive design principles

## Code Formatting

- Use Prettier with the project's configuration
- Maintain consistent naming conventions:
  - PascalCase for components and types
  - camelCase for variables and functions
  - UPPERCASE for constants

## Documentation

- Use Comments Strategically:
  - Add comments only when necessary. Well-written code with descriptive names should minimize the need for comments.
  - Avoid stating the obvious (e.g., `// Increment counter` for `counter++`).
- Explain the Why, Not the What:
  - Focus on documenting the reasoning behind decisions, trade-offs, and approaches.
- Highlight Known Issues:
  - Document limitations, known bugs, or edge cases where behavior may not align with expectations.

## Code Organization

- Prefer small, focused functions over inline code
- Prefer util functions for reusable logic and common operations
- Extract complex logic into well-named functions
- Prefer early returns over nested conditionals for better readability
- Function names should describe their purpose clearly:

```typescript
// ❌ Unclear and inline
const result = items.filter(
  (x) => x.date > now && x.status === "active" && !x.isArchived,
);

// ✅ Clear and reusable
const getActiveUnarchivedItems = (items: Item[]) => {
  return items.filter(isActiveAndUnarchived);
};

const isActiveAndUnarchived = (item: Item) => {
  return item.date > now && item.status === "active" && !item.isArchived;
};
```

- Choose descriptive function names that make comments unnecessary:

```typescript
  // ❌ Needs a comment to explain
  // Check if user can access premium features
  const check = (user: User) => { ... }

  // ✅ Self-documenting function name
  const hasValidPremiumSubscription = (user: User) => { ... }
```

- Break down complex operations into smaller, meaningful functions:

```typescript
// ❌ Large, multi-purpose function
const processData = (data: Data) => {
  // 30 lines of validation
  // 20 lines of transformation
  // 15 lines of formatting
};

// ✅ Composed of focused functions
const processData = (data: Data) => {
  const validatedData = validateDataFormat(data);
  const transformedData = transformToDesiredFormat(validatedData);
  return formatForDisplay(transformedData);
};

```

## Testing

- Write unit tests for new functionality
- Ensure tests are meaningful and maintainable
