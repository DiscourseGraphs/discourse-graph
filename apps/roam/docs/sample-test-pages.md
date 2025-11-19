# Sample Query Builder Test Pages

This document contains example test pages that you can import into your Roam graph. Each test demonstrates different aspects of the query builder.

## Import Instructions

To import these test pages:

1. Copy the entire markdown content for a test
2. In Roam, create a new page with the exact title shown
3. Paste the content into the page
4. Run the test using the command palette

## Test 1: Basic Discourse Node Query

**Page Title:** `discourse-graph/tests/queries/basic-hypothesis-query`

```markdown
- description
  - Tests basic query for Hypothesis discourse nodes
- {{query block}}
  - scratch
    - conditions
      - clause
        - source
          - node
        - Relation
          - is a
        - target
          - Hypothesis
    - selections
    - custom
- expected
  - count
    - (Set this to the actual number of Hypothesis nodes in your graph)
```

## Test 2: Discourse Relation Query (Pattern-based)

**Page Title:** `discourse-graph/tests/queries/supports-relation`

```markdown
- description
  - Tests querying Supports relation
- {{query block}}
  - scratch
    - conditions
      - clause
        - source
          - node
        - Relation
          - Supports
        - target
          - Hypothesis
    - selections
    - custom
- expected
  - (Add specific UIDs if you have test data)
```

## Test 4: OR Conditions

**Page Title:** `discourse-graph/tests/queries/or-multiple-types`

```markdown
- description
  - Tests OR conditions to query multiple discourse node types
- {{query block}}
  - scratch
    - conditions
      - or
        - clause
          - source
            - node
          - Relation
            - is a
          - target
            - Hypothesis
        - clause
          - source
            - node
          - Relation
            - is a
          - target
            - Question
    - selections
    - custom
```

## Test 5: NOT Conditions

**Page Title:** `discourse-graph/tests/queries/not-specific-relation`

```markdown
- description
  - Tests NOT condition to exclude nodes with specific relations
- {{query block}}
  - scratch
    - conditions
      - clause
        - source
          - node
        - Relation
          - is a
        - target
          - Evidence
      - not
        - source
          - node
        - Relation
          - Supports
        - target
          - Hypothesis
    - selections
    - custom
```

## Test 6: Complex Query with Multiple Relations

**Page Title:** `discourse-graph/tests/queries/complex-multi-relation`

Note: This returns nothing. I feel it should return a join...

```markdown
- description
  - Tests complex query with multiple relations and node types
  - Finds Evidence that Supports a Hypothesis which Informs a Question
- {{query block}}
  - scratch
    - conditions
      - clause
        - source
          - node
        - Relation
          - Addresses
        - target
          - Flow
      - clause
        - source
          - Flow
        - Relation
          - Enacts
        - target
          - Function
    - custom
```

## Test 7: Query with Selections

**Page Title:** `discourse-graph/tests/queries/query-with-selections`

```markdown
- description
  - Tests query with multiple selection types
- {{query block}}
  - scratch
    - conditions
      - clause
        - source
          - node
        - Relation
          - is a
        - target
          - Hypothesis
    - selections
      - Created Date
        - Date Created
      - Author
        - Created By
    - custom
```

## Test 8: Any Relation Query

**Page Title:** `discourse-graph/tests/queries/any-relation-pattern`

```markdown
- description
  - Tests querying with the 'Any Relation' pattern
  - Finds all nodes connected to a specific node by any relation
- {{query block}}
  - scratch
    - conditions
      - clause
        - source
          - connected
        - Relation
          - Any Relation
        - target
          - ((replace-with-specific-uid))
    - selections
    - custom
```

## Test 9: Title-based Node Query

**Page Title:** `discourse-graph/tests/queries/has-title-query`

```markdown
- description
  - Tests querying nodes by exact title match
- {{query block}}
  - scratch
    - conditions
      - clause
        - source
          - node
        - Relation
          - has title
        - target
          - (Specific page title to match)
    - selections
    - custom
- expected
  - count
    - 1
```

## Test 10: Regex Title Query

**Page Title:** `discourse-graph/tests/queries/regex-title-pattern`

```markdown
- description
  - Tests querying nodes using regex pattern in title
- {{query block}}
  - scratch
    - conditions
      - clause
        - source
          - node
        - Relation
          - has title
        - target
          - /\[\[HYP\]\].\*/
    - selections
    - custom
```

## Creating Your Own Tests

When creating your own test pages:

1. **Start simple**: Test one feature at a time
2. **Use real data**: Reference actual UIDs and page titles from your graph
3. **Set expectations**: Add count/contains/excludes to validate results
4. **Test edge cases**: Empty results, large result sets, etc.
5. **Document purpose**: Write clear descriptions

### Template for New Tests

```markdown
- description
  - (What does this test validate?)
- {{query block}}
  - scratch
    - conditions
      - (Your conditions here)
    - selections
      - (Your selections here)
    - custom
      - (Optional custom datalog)
- expected
  - count
    - (Expected number of results)
  - contains
    - (UIDs that should be present)
  - excludes
    - (UIDs that should NOT be present)
```

## Running These Tests

After importing these test pages:

1. Open command palette (`Cmd/Ctrl + P`)
2. Choose "Query Builder: Run All Tests"
3. Check the console for results
4. Modify expectations based on your graph's actual data

## Benchmarking Your Changes

To benchmark the impact of your recent query builder changes:

1. Import all sample tests
2. Customize them with real data from your graph
3. Run "Query Builder: Benchmark Tests" **before** your changes
4. Save the benchmark output
5. Apply your changes
6. Run benchmarks again
7. Compare the results

Example comparison workflow:

```javascript
// Save baseline
const baseline = await window.roamjs.extension.queryBuilder.test.runAllTests();
console.log("BASELINE BENCHMARKS:");
console.log(
  window.roamjs.extension.queryBuilder.test.formatBenchmarkResults(baseline),
);

// ... make your changes ...

// Compare
const updated = await window.roamjs.extension.queryBuilder.test.runAllTests();
console.log("UPDATED BENCHMARKS:");
console.log(
  window.roamjs.extension.queryBuilder.test.formatBenchmarkResults(updated),
);
```

## Test Coverage for Recent Changes

For your recent reified relations changes (commits in last 6 commits), create tests covering:

1. **Reified relations with UIDs**: Source and target are specific UIDs
2. **Reified relations with node types**: Source and target are discourse node types
3. **Reified relations with mixed**: One is UID, one is node type
4. **Multiple relation IDs**: Same relation label maps to multiple IDs
5. **Forward and reverse relations**: Both complement directions
6. **Query optimizer**: Verify optimized queries produce same results

Example specialized test for reified relations:

```markdown
- discourse-graph/tests/queries/reified-mixed-uid-and-type
  - description
    - Tests reified relation where source is UID and target is node type
  - {{query block}}
    - scratch
      - conditions
        - clause
          - source
            - ((specific-evidence-uid))
          - Relation
            - Supports
          - target
            - Hypothesis
      - selections
        - node:Hypothesis
          - Hypothesis Supported
      - custom
  - expected
    - (Set based on your data)
```
