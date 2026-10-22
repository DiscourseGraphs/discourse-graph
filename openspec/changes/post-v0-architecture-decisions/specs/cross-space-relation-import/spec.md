# Spec Delta

## Purpose

How Roam and Obsidian find relations that another space created and bring them into the graph or vault, including relations between two of the user's own nodes.

## ADDED Requirements

### Requirement: Import and refresh find relations between the user's own nodes

On every node import and every refresh, Roam and Obsidian SHALL look for relations in other spaces whose two ends both resolve in the graph or vault, whether each end is an imported node or one of the user's own nodes. Sources: [ENG-2394], [ENG-2340], [ENG-2339].

#### Scenario: Another user relates two of my nodes

- **WHEN** user A publishes nodes A and B, user B imports them, relates them and publishes the relation, and user A then runs an import or a refresh in Obsidian
- **THEN** Obsidian imports the relation between A and B ([ENG-2394])

#### Scenario: The same case in Roam

- **WHEN** the same happens and user A runs an import or a refresh in Roam
- **THEN** Roam imports the relation between A and B ([ENG-2340], [ENG-2394])

#### Scenario: Refresh with nothing imported

- **WHEN** user A has imported no nodes and runs "Fetch latest content from imported nodes" in Obsidian
- **THEN** Obsidian still looks for relations between user A's own nodes ([ENG-2394])

#### Scenario: Only one end resolves

- **WHEN** a relation's other end resolves neither to an imported node nor to one of the user's own nodes
- **THEN** the relation is not imported ([ENG-2339], [ENG-2394])

### Requirement: A relation is imported once

Roam and Obsidian SHALL NOT import a relation whose source, destination and relation type match a relation the graph or vault already holds. Sources: [ENG-2394].

#### Scenario: Refresh twice

- **WHEN** a refresh imports a relation, and the user runs a refresh again
- **THEN** the second refresh doesn't create another copy of that relation ([ENG-2394])

### Requirement: Obsidian tells the user what it imported

When the lookup imports one or more relations, Obsidian SHALL show a notice with the number of relations it imported. Sources: [ENG-2394].

#### Scenario: Two relations found

- **WHEN** an import or a refresh imports two relations
- **THEN** Obsidian shows a notice that says it imported 2 relations ([ENG-2394])

[ENG-2339]: https://linear.app/discourse-graphs/issue/ENG-2339
[ENG-2340]: https://linear.app/discourse-graphs/issue/ENG-2340
[ENG-2394]: https://linear.app/discourse-graphs/issue/ENG-2394
