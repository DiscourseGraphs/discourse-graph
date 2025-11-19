# Query Builder Testing Guide

This document describes how to test the Query Builder using the in-Roam testing harness.

## Overview

The Query Builder test harness allows you to:

- **Run queries against real Roam data** without mocking
- **Benchmark query performance** to measure improvements
- **Store test cases in Roam pages** for easy maintenance and collaboration
- **Test discourse relation queries** including reified relations

## Creating Test Pages

Test pages are regular Roam pages with a specific naming convention and structure.

### Page Naming Convention

All test pages must have titles starting with:

```
discourse-graph/tests/queries/
```

Example test page titles:

- `discourse-graph/tests/queries/basic-node-query`
- `discourse-graph/tests/queries/reified-relation-supports`
- `discourse-graph/tests/queries/complex-or-conditions`

### Test Page Structure

Each test page should have the following children:

```
- discourse-graph/tests/queries/my-test-name
    - description
        - Brief description of what this test validates
    - {{query block}}
        - scratch
            - conditions
                - [Your query conditions here]
            - selections
                - [Your selections here]
            - custom
                - [Optional custom datalog]
    - expected (optional)
        - count
            - 5
        - contains
            - uid-1
            - uid-2
        - excludes
            - uid-3
```

#### Test Structure Fields

- **description**: A brief description of what the test validates
- **query**: The query block (same structure as regular Query Builder queries)
  - **scratch**: Contains the query configuration
    - **conditions**: Query conditions (clauses, or, not, etc.)
    - **selections**: Fields to select in results
    - **custom**: Optional custom datalog query
- **expected** (optional): Expected results validation
  - **count**: Expected number of results
  - **contains**: List of UIDs that should be present in results
  - **excludes**: List of UIDs that should NOT be present in results

## Running Tests

### Via Command Palette

Open the command palette (`Cmd/Ctrl + P`) and choose:

1. **Query Builder: Run All Tests**
   - Runs all test pages
   - Shows pass/fail summary
   - Displays benchmarks

2. **Query Builder: Run Test on Current Page**
   - Runs the test on the currently open page
   - Must be on a test page

3. **Query Builder: Benchmark Tests**
   - Runs all tests and displays detailed performance metrics
   - Sorts by execution time

4. **Query Builder: List All Tests**
   - Lists all available test pages

### Programmatic API

You can also run tests programmatically from the console:

```javascript
// Run all tests
const results = await window.roamjs.extension.queryBuilder.test.runAllTests();

// Run a single test
const result = await window.roamjs.extension.queryBuilder.test.runSingleTest(
  "discourse-graph/tests/queries/my-test",
);

// Format and display results
console.log(
  window.roamjs.extension.queryBuilder.test.formatTestResults(results),
);
console.log(
  window.roamjs.extension.queryBuilder.test.formatBenchmarkResults(results),
);
```

## Example Test Cases

### Example 1: Basic Node Query

**Page**: `discourse-graph/tests/queries/basic-hypothesis-query`

```
- discourse-graph/tests/queries/basic-hypothesis-query
    - description
        - Tests querying for Hypothesis discourse nodes
    - query
        - scratch
            - conditions
                - clause
                    - source
                        - node
                    - relation
                        - is a
                    - target
                        - Hypothesis
            - selections
    - expected
        - count
            - 3
```

### Example 2: Reified Relation Query

**Page**: `discourse-graph/tests/queries/reified-supports-relation`

```
- discourse-graph/tests/queries/reified-supports-relation
    - description
        - Tests querying reified 'Supports' relations from a specific node
    - query
        - scratch
            - conditions
                - clause
                    - source
                        - evidence
                    - relation
                        - Supports
                    - target
                        - ((uid-of-hypothesis))
            - selections
    - expected
        - contains
            - uid-of-evidence-1
            - uid-of-evidence-2
```

### Example 3: Complex OR Conditions

**Page**: `discourse-graph/tests/queries/or-multiple-node-types`

```
- discourse-graph/tests/queries/or-multiple-node-types
    - description
        - Tests OR conditions with multiple discourse node types
    - query
        - scratch
            - conditions
                - or
                    - clause
                        - source
                            - node
                        - relation
                            - is a
                        - target
                            - Hypothesis
                    - clause
                        - source
                            - node
                        - relation
                            - is a
                        - target
                            - Question
            - selections
```

### Example 4: Relation with Specific UIDs

**Page**: `discourse-graph/tests/queries/specific-uid-relation`

```
- discourse-graph/tests/queries/specific-uid-relation
    - description
        - Tests relation query with specific source and target UIDs
    - query
        - scratch
            - conditions
                - clause
                    - source
                        - sourceuid123
                    - relation
                        - Supports
                    - target
                        - targetuid456
            - selections
    - expected
        - count
            - 0
```

## Understanding Test Results

### Console Output

When you run tests, you'll see output like this:

```
============================================================
Query Builder Test Results
============================================================
Total: 10 | Passed: 9 | Failed: 1
============================================================

✓ PASS basic-hypothesis-query (45.23ms)
  Description: Tests querying for Hypothesis discourse nodes

✓ PASS reified-supports-relation (123.45ms)
  Description: Tests querying reified 'Supports' relations

✗ FAIL or-multiple-node-types (67.89ms)
  Description: Tests OR conditions with multiple discourse node types
  Expected 5 results, got 4
  Missing UIDs: uid-xyz123

============================================================
Query Builder Benchmark Results
============================================================

Test Name                                | Duration (ms) | Status
-----------------------------------------|--------------:|-------
complex-nested-query                     |       234.56 | PASS
reified-supports-relation                |       123.45 | PASS
...

============================================================
Summary Statistics:
  Total Time: 1234.56ms
  Average: 123.46ms
  Min: 12.34ms
  Max: 234.56ms
============================================================
```

### Test Result Fields

- **name**: Test name (from page title)
- **description**: Test description
- **passed**: Whether the test passed
- **duration**: Execution time in milliseconds
- **error**: Error message if the test failed
- **details**: Additional information about the failure

## Testing Strategies

### Testing Recent Changes

When you make changes to the query builder (like the recent reified relations updates), create test cases that:

1. **Test the happy path**: Standard usage of the new feature
2. **Test edge cases**: Empty results, missing relations, etc.
3. **Test backward compatibility**: Ensure old patterns still work
4. **Test performance**: Compare execution times before and after

### Benchmarking Performance

To measure performance improvements:

1. Create a set of representative queries
2. Run benchmarks before your changes (save the output)
3. Make your changes
4. Run benchmarks again
5. Compare the results

Example benchmark comparison:

```
Before: Complex query averaged 250ms
After:  Complex query averaged 180ms
Improvement: 28% faster
```

### Test-Driven Development

You can use this harness for TDD:

1. Create a test page describing the desired behavior
2. Set expectations (count, contains, excludes)
3. Run the test (it will fail initially)
4. Implement the feature
5. Run the test until it passes

## Troubleshooting

### Test Page Not Found

- Ensure the page title starts with `discourse-graph/tests/queries/`
- Check that the page actually exists in your graph

### Query Parsing Errors

- Verify your query structure matches the standard Query Builder format
- Check that required fields (scratch, conditions) are present

### Unexpected Results

- Use the "Run Test on Current Page" command for detailed error messages
- Check the console for the generated datalog query
- Verify your expectations match the actual data in your graph

## Best Practices

1. **Name tests descriptively**: Use clear names that describe what's being tested
2. **Add descriptions**: Help future maintainers understand the test purpose
3. **Keep tests focused**: Test one thing per test page
4. **Use realistic data**: Test against actual discourse graph data
5. **Document edge cases**: Create tests for boundary conditions
6. **Version control**: Consider exporting test pages to markdown for git tracking

## Integration with Development Workflow

### Pre-commit Testing

Before committing query builder changes:

```
1. Run "Query Builder: Run All Tests"
2. Ensure all tests pass
3. Check for performance regressions in benchmarks
4. Commit changes
```

### Continuous Testing

Set up a test suite that covers:

- All relation types
- All discourse node types
- Various condition combinations (AND, OR, NOT)
- Different selection types
- Edge cases (empty results, large result sets)

## Future Enhancements

Potential improvements to the test harness:

- **Automated regression testing**: Compare results against saved snapshots
- **Test coverage reporting**: Track which query features are tested
- **Performance regression detection**: Alert on significant slowdowns
- **Test generation**: Auto-generate tests from example queries
- **CI/CD integration**: Export tests and run in automated pipelines
