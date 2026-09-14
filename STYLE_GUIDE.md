# Style Guide

This document outlines the coding standards and best practices for contributing to Discourse Graphs.

## TypeScript Guidelines

- Prefer `type` over `interface`
- Use explicit return types for functions
- Avoid `any` types when possible
- Prefer arrow functions over regular function declarations
- Use named parameters (object destructuring) when a function has more than 2 parameters

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

## Code comments

Ask: **What would a maintainer get wrong if this comment were removed?** If there is no specific answer, remove it.

Keep comments that explain non-obvious decisions, external API or data constraints, known limitations, side effects, or ordering requirements. Prefer descriptive names when they can convey the same information.

Before keeping a comment, check:

- **Necessary:** Would removing it hide information needed to safely change or use the code?
- **Accurate:** Does it describe the actual guarantee, including relevant exceptions?
- **Concise:** Can it be shortened without losing necessary information?
- **Durable:** Will it still matter after this PR merges?
- **Local:** Is it next to the code that depends on the information?

Prefer one or two short sentences. Use longer explanations or examples when the constraint requires them; this is not a hard length limit.

Do not restate function names, types, test names, assertions, or obvious operations. Do not repeat an explanation already documented at its source; link to it when needed.

Put implementation history, review iterations, scope justifications, and ticket splits in inline GitHub comments. Keep durable constraints and known limitations in code or linked documentation. Link to the decision when describing behavior as agreed or accepted.

Agents must check added and modified comments against these criteria before handoff. Authors must review them manually before requesting review.

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

## Documentation

- Use sentence case by default in docs and UI copy. Capitalize official product/plugin names and exact UI labels, buttons, or page titles, but keep generic feature terms lowercase.

## Testing

- Write unit tests for new functionality
- Ensure tests are meaningful and maintainable
