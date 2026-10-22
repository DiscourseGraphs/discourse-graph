# Spec Delta

## Purpose

How Roam and Obsidian write their nodes to the shared database, so a node is never left half-written and the two Roam write paths store the same values.

## ADDED Requirements

### Requirement: One write per node

Roam sync and Obsidian sync SHALL write each node's Concept and its Content in one database call, with the Content inside the Concept. They SHALL make no Content-only write. Sources: [ENG-1794], [ENG-1823], [ENG-1824].

#### Scenario: The write fails

- **WHEN** the database call that writes a node fails
- **THEN** that call leaves neither the node's Concept nor its Content written ([ENG-1794], [ENG-1823], [ENG-1824])

#### Scenario: No Content-only write

- **WHEN** Roam sync or Obsidian sync writes a node
- **THEN** it makes no separate call that writes only the node's Content ([ENG-1823], [ENG-1824])

#### Scenario: The upsert route doesn't exist yet

- **WHEN** the upsert route from [FEE-890] is not built
- **THEN** Roam sync and Obsidian sync still write each node in one call, directly to the database ([ENG-1823], [ENG-1824], [ENG-2412])

### Requirement: Sync repairs half-written nodes

The first sync after a graph or vault loads SHALL write again, in full, every node that the database holds without its Concept or without its Content. No data migration is needed. Sources: [ENG-1794], [ENG-1793], [ENG-1791].

#### Scenario: A node is missing its Concept

- **WHEN** the database holds a node's Content but not its Concept, and the first sync after load runs
- **THEN** that sync writes the node's Concept and Content again ([ENG-1794], [ENG-1793], [ENG-1791])

### Requirement: Roam sync and Roam publish store the same values

Roam sync and Roam publish SHALL convert a node to its database values through the same CrossApp conversion, so neither overwrites the other with different values for an unchanged node. Sources: [ENG-2165], [ENG-1824], [ENG-2166].

#### Scenario: Publish, then sync, an unchanged node

- **WHEN** Roam publish writes a node, and Roam sync later writes the same node without any change to it in Roam
- **THEN** no field of the stored Concept or Content changes ([ENG-2165], [ENG-2166])

#### Scenario: Sync, then publish, an unchanged node

- **WHEN** Roam sync writes a node, and Roam publish later writes the same node without any change to it in Roam
- **THEN** no field of the stored Concept or Content changes ([ENG-2165], [ENG-2166])

[ENG-1791]: https://linear.app/discourse-graphs/issue/ENG-1791
[ENG-1793]: https://linear.app/discourse-graphs/issue/ENG-1793
[ENG-1794]: https://linear.app/discourse-graphs/issue/ENG-1794
[ENG-1823]: https://linear.app/discourse-graphs/issue/ENG-1823
[ENG-1824]: https://linear.app/discourse-graphs/issue/ENG-1824
[ENG-2165]: https://linear.app/discourse-graphs/issue/ENG-2165
[ENG-2166]: https://linear.app/discourse-graphs/issue/ENG-2166
[ENG-2412]: https://linear.app/discourse-graphs/issue/ENG-2412
[FEE-890]: https://linear.app/discourse-graphs/issue/FEE-890
