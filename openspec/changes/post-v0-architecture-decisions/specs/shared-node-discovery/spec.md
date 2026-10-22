# Spec Delta

## Purpose

What Roam and Obsidian receive when they list the nodes in the spaces shared with the user, which is also what node import starts from.

## ADDED Requirements

### Requirement: Discovery returns CrossApp nodes

Discovery SHALL return each listed node as a `CrossAppNode`. Roam and Obsidian SHALL still get everything they read from the listing today: the node's space id, space name, space URI and platform; its node type, resolvable to the node type Roam imports it as; its author, resolvable to the name Obsidian shows; and its direct Content's metadata. Sources: [ENG-2091](https://linear.app/discourse-graphs/issue/ENG-2091).

#### Scenario: Roam lists the nodes in a shared space

- **WHEN** Roam's discover dialog lists the nodes in a shared space
- **THEN** each node is a `CrossAppNode`, and the dialog shows each node's title, space name, space URI and modified time as before ([ENG-2091](https://linear.app/discourse-graphs/issue/ENG-2091))

#### Scenario: Obsidian shows authors

- **WHEN** Obsidian's import modal lists the nodes in a shared space
- **THEN** it shows each node's author name as before ([ENG-2091](https://linear.app/discourse-graphs/issue/ENG-2091), [ENG-2045](https://linear.app/discourse-graphs/issue/ENG-2045))

#### Scenario: Obsidian needs the original file path

- **WHEN** Obsidian lists the nodes in a shared space
- **THEN** each node carries its direct Content's metadata, so import can read the file path the node had in its source vault ([ENG-2091](https://linear.app/discourse-graphs/issue/ENG-2091), [ENG-2045](https://linear.app/discourse-graphs/issue/ENG-2045))

### Requirement: The listing leaves out full content

Discovery SHALL NOT include a node's full content. A node's modified time SHALL still be the latest time of its Concept, its direct Content and its full Content. Import SHALL fetch the full content of each node it imports. Sources: [ENG-2091](https://linear.app/discourse-graphs/issue/ENG-2091).

#### Scenario: Listing, then importing

- **WHEN** discovery lists nodes and the user imports one of them
- **THEN** the listing has no full content for any node, and import fetches the full content of the node being imported ([ENG-2091](https://linear.app/discourse-graphs/issue/ENG-2091))

#### Scenario: Only the body changed

- **WHEN** the source edits only a node's body, so only its full Content changes
- **THEN** discovery reports the node's new modified time, and refreshing the imported copy picks up the edit ([ENG-2091](https://linear.app/discourse-graphs/issue/ENG-2091))

### Requirement: Removing SharedNode loses no behavior

`SharedNode` SHALL be removed, and every behavior that used it SHALL keep working: Roam's discover dialog (display and filter), Roam import, refresh and asset import, and Obsidian import. Sources: [ENG-2091](https://linear.app/discourse-graphs/issue/ENG-2091), [ENG-2045](https://linear.app/discourse-graphs/issue/ENG-2045).

#### Scenario: Filtering the discover dialog

- **WHEN** a user filters Roam's discover dialog by space name, space URI or title
- **THEN** the dialog shows the same nodes it showed before `SharedNode` was removed ([ENG-2091](https://linear.app/discourse-graphs/issue/ENG-2091))

#### Scenario: Import with a source slot

- **WHEN** a user imports a node whose Source slot points at another node in the same space
- **THEN** the imported node's Source reference resolves the same way it did before `SharedNode` was removed ([ENG-2091](https://linear.app/discourse-graphs/issue/ENG-2091))
