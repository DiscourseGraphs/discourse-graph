# Spec Delta

## Purpose

The planned Next.js route through which Roam and Obsidian write nodes, relations and schemas, so the conversion to database rows runs on the server instead of in each plugin.

Only the settled behavior is specified here. The route's open details (what it does with a missing relation type, its name, what a user can do with an error, who computes embeddings, how its tests run) are in `design.md`, open for Michael.

## ADDED Requirements

### Requirement: The route takes CrossApp types and writes them in one upsert

The upsert route SHALL accept any mix of the root CrossApp types (node schemas, relation type schemas, relation triple schemas, nodes and relations) for one space, and SHALL write them in one database upsert. Sources: [FEE-890](https://linear.app/discourse-graphs/issue/FEE-890), [ENG-2412](https://linear.app/discourse-graphs/issue/ENG-2412).

#### Scenario: A payload of nodes and their schemas

- **WHEN** an action function sends nodes together with their node schemas for one space
- **THEN** the route writes the schemas and the nodes in one database upsert ([FEE-890](https://linear.app/discourse-graphs/issue/FEE-890))

### Requirement: The route identifies the caller from the plugin's own login

The upsert route SHALL identify the caller from the Supabase session that the plugin signed in with. It SHALL NOT depend on website cookies, which plugin requests from Roam or Obsidian don't carry. Sources: [FEE-890](https://linear.app/discourse-graphs/issue/FEE-890).

#### Scenario: A plugin calls with its own session

- **WHEN** Roam or Obsidian calls the route with the session it signed in with, and with no website cookie
- **THEN** the route identifies the caller's account and writes the payload ([FEE-890](https://linear.app/discourse-graphs/issue/FEE-890))

#### Scenario: No valid session

- **WHEN** a request carries no valid session
- **THEN** the route refuses it and writes nothing ([FEE-890](https://linear.app/discourse-graphs/issue/FEE-890))

### Requirement: The route checks the request body before writing

The upsert route SHALL check that the request body conforms to the CrossApp types before it writes anything. Sources: [ENG-2005](https://linear.app/discourse-graphs/issue/ENG-2005), [FEE-890](https://linear.app/discourse-graphs/issue/FEE-890).

#### Scenario: A body that doesn't conform

- **WHEN** the request body doesn't conform to the CrossApp types
- **THEN** the route refuses the request and writes nothing ([ENG-2005](https://linear.app/discourse-graphs/issue/ENG-2005))
