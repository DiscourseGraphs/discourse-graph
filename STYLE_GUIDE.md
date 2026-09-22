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
- When refactoring inline styles, use Tailwind classes.
- Use platform-native UI components first ([blueprintjs for Roam](https://roamresearch.com/#/app/developer-documentation/page/5BB8h4I7b), [Lucide icons for Obsidian](https://help.obsidian.md/Contributing+to+Obsidian/Style+guide), etc), with [shadcn/ui](https://ui.shadcn.com/) as a fallback
- Maintain visual consistency with the host application's design system
- Follow responsive design principles
- Use `text-red-700` for Roam error message text. Obsidian keeps `text-error`; website and shared UI keep `text-destructive`. This convention does not change danger buttons, borders, backgrounds, or diagram colors.

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
- **Accurate:** Does it match what the code actually does, including relevant limitations and exceptions?
- **Concise:** Can it be shortened without losing necessary information?
- **Durable:** Will it still matter after this PR merges?
- **Local:** Is it next to the code that depends on the information?

Prefer one or two short sentences. Use longer explanations or examples when the constraint requires them; this is not a hard length limit.

Do not restate function names, types, test names, assertions, or obvious operations. Do not repeat an explanation already documented at its source; link to it when needed.

Put implementation history, review iterations, scope justifications, and ticket splits in inline GitHub comments. Keep durable constraints and known limitations in code or linked documentation. Link to the decision when describing behavior as agreed or accepted.

Agents must check added and modified comments against these criteria before handoff. Authors must review them manually before requesting review.

## Code Organization

- Prefer small, focused functions over inline code
- Co-locate code with its primary usage. Export it only for a concrete reuse need.
- Move code to `/utils` when it is shared across multiple call sites. Consider a shared package only after the code has stabilized and proven broadly reusable.
- Ground code movement in a current use case. Moving code because it feels cleaner adds churn without a clear functional benefit.
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

## Code hygiene

- Remove unused imports, temporary comments, and debug logging before requesting review. Preserve intentional operational logging.
- Handle errors gracefully and log enough context to diagnose failures without exposing credentials or sensitive data.

## Testing

- Write unit tests for new functionality
- Ensure tests are meaningful and maintainable
- Cover relevant edge cases, error paths, and alternative flows.
- Expose workspace unit tests through a `test:unit` script so the root validation command includes them.
