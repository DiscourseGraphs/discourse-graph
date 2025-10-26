Feature: Concept queries
  User story:
  * As a user of the Roam plugin
  * Logged in through a given space's anonymous account
  * With existing concepts
  * I want to make various concept queries

  Acceptance criteria:
  * The queries should succeed

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1
    And the user user2 opens the Roam plugin in space s1
    And the user user3 opens the Roam plugin in space s1
    # Add Documents as support for the Content objects
    # Note: table syntax is explained in features/step-definitions/stepdefs.ts, look for `added to the database`.
    And Document are added to the database:
      | $id | source_local_id | created    | last_modified | _author_id | _space_id |
      | d1  | ld1             | 2025/01/01 |    2025/01/01 | user1      | s1        |
      | d2  | ld2             | 2025/01/01 |    2025/01/01 | user1      | s1        |
      | d5  | ld5             | 2025/01/01 |    2025/01/01 | user2      | s1        |
      | d7  | ld7             | 2025/01/01 |    2025/01/01 | user1      | s1        |
    # Add Content as support for the Concept objects, esp. schemas
    And Content are added to the database:
      | $id | source_local_id | _document_id | text       | created    | last_modified | scale    | _author_id | _space_id |
      | ct1 | lct1            | d1           | Claim      | 2025/01/01 |    2025/01/01 | document | user1      | s1        |
      | ct2 | lct2            | d2           | claim 1    | 2025/01/01 |    2025/01/01 | document | user1      | s1        |
      | ct5 | lct5            | d5           | Opposes    | 2025/01/01 |    2025/01/01 | document | user2      | s1        |
      | ct7 | lct7            | d7           | Hypothesis | 2025/01/01 |    2025/01/01 | document | user1      | s1        |
    # First add schemas
    And Concept are added to the database:
      | $id | name       | _space_id | _author_id | _represented_by_id | created    | last_modified | @is_schema | _schema_id | @literal_content                | @reference_content |
      | c1  | Claim      | s1        | user1      | ct1                | 2025/01/01 |    2025/01/01 | true       |            | {}                              | {}                 |
      | c5  | Opposes    | s1        | user1      | ct5                | 2025/01/01 |    2025/01/01 | true       |            | {"roles": ["target", "source"]} | {}                 |
      | c7  | Hypothesis | s1        | user1      | ct7                | 2025/01/01 |    2025/01/01 | true       |            | {}                              | {}                 |
    # Then nodes referring to the schemas
    And Concept are added to the database:
      | $id | name         | _space_id | _author_id | created    | last_modified | @is_schema | _schema_id | @literal_content | @reference_content | _represented_by_id |
      | c2  | claim 1      | s1        | user1      | 2025/01/01 |    2025/01/01 | false      | c1         | {}               | {}                 | ct2                |
      | c3  | claim 2      | s1        | user2      | 2025/01/01 |    2025/01/01 | false      | c1         | {}               | {}                 |                    |
      | c4  | claim 3      | s1        | user3      | 2025/01/01 |    2025/01/01 | false      | c1         | {}               | {}                 |                    |
      | c8  | hypothesis 1 | s1        | user3      | 2025/01/01 |    2025/01/01 | false      | c7         | {}               | {}                 |                    |
    # Then relations (which refer to nodes)
    And Concept are added to the database:
      | $id | name      | _space_id | _author_id | created    | last_modified | @is_schema | _schema_id | @literal_content | @_reference_content              |
      | c6  | opposes 1 | s1        | user2      | 2025/01/01 |    2025/01/01 | false      | c5         | {}               | {"target": "c3", "source": "c2"} |
      | c9  | opposes 2 | s1        | user2      | 2025/01/01 |    2025/01/01 | false      | c5         | {}               | {"target": "c8", "source": "c2"} |

  Scenario Outline: Query all nodes
    And a user logged in space s1 and calling getConcepts with these parameters: '{"scope":{"type":"all"}}'
    Then query results should look like this
      | _id | name         | _space_id | _author_id | @is_schema | _schema_id | @_reference_content              |
      | c2  | claim 1      | s1        | user1      | false      | c1         | {}                               |
      | c3  | claim 2      | s1        | user2      | false      | c1         | {}                               |
      | c4  | claim 3      | s1        | user3      | false      | c1         | {}                               |
      | c6  | opposes 1    | s1        | user2      | false      | c5         | {"target": "c3", "source": "c2"} |
      | c8  | hypothesis 1 | s1        | user3      | false      | c7         | {}                               |
      | c9  | opposes 2    | s1        | user2      | false      | c5         | {"target": "c8", "source": "c2"} |

  Scenario Outline: Query node schemas
    And a user logged in space s1 and calling getConcepts with these parameters: '{"scope":{"schemas":true}}'
    Then query results should look like this
      | _id | name       | _space_id | _author_id | @is_schema | _schema_id | @literal_content                | @reference_content | _represented_by_id |
      | c1  | Claim      | s1        | user1      | true       |            | {}                              | {}                 | ct1                |
      | c5  | Opposes    | s1        | user1      | true       |            | {"roles": ["target", "source"]} | {}                 | ct5                |
      | c7  | Hypothesis | s1        | user1      | true       |            | {}                              | {}                 | ct7                |

  Scenario Outline: Query by node types
    And a user logged in space s1 and calling getConcepts with these parameters: '{"scope":{"ofTypes":["lct1"]}}'
    Then query results should look like this
      | _id | name    | _space_id | _author_id | @is_schema | _schema_id | @literal_content | @reference_content |
      | c2  | claim 1 | s1        | user1      | false      | c1         | {}               | {}                 |
      | c3  | claim 2 | s1        | user2      | false      | c1         | {}               | {}                 |
      | c4  | claim 3 | s1        | user3      | false      | c1         | {}               | {}                 |

  Scenario Outline: Query by author
    And a user logged in space s1 and calling getConcepts with these parameters: '{"scope":{"author":"user2","type":"all"}}'
    Then query results should look like this
      | _id | name      | _space_id | _author_id | @is_schema | _schema_id | @literal_content | @_reference_content              |
      | c3  | claim 2   | s1        | user2      | false      | c1         | {}               | {}                               |
      | c6  | opposes 1 | s1        | user2      | false      | c5         | {}               | {"target": "c3", "source": "c2"} |
      | c9  | opposes 2 | s1        | user2      | false      | c5         | {}               | {"target": "c8", "source": "c2"} |

  Scenario Outline: Query by relation type
    And a user logged in space s1 and calling getConcepts with these parameters: '{"relations":{"ofTypes":["lct5"]}}'
    Then query results should look like this
      | _id | name         | _space_id | _author_id | @is_schema | _schema_id | @literal_content | @_reference_content |
      | c2  | claim 1      | s1        | user1      | false      | c1         | {}               | {}                  |
      | c3  | claim 2      | s1        | user2      | false      | c1         | {}               | {}                  |
      | c8  | hypothesis 1 | s1        | user3      | false      | c7         | {}               | {}                  |

  Scenario Outline: Query by related node type
    And a user logged in space s1 and calling getConcepts with these parameters: '{"relations":{"toNodeTypes":["lct7"]}}'
    Then query results should look like this
      | _id | name         | _space_id | _author_id | @is_schema | _schema_id | @literal_content | @_reference_content |
      | c2  | claim 1      | s1        | user1      | false      | c1         | {}               | {}                  |
      | c8  | hypothesis 1 | s1        | user3      | false      | c7         | {}               | {}                  |
  # Note that the node is related to itself, unfortunate but hard to solve.

  Scenario Outline: Query by author of related node
    And a user logged in space s1 and calling getConcepts with these parameters: '{"relations":{"author":"user3"},"fields":{"relations":["id"],"relationNodes":["id"]}}'
    Then query results should look like this
      | _id | name         | _space_id | _author_id | @is_schema | _schema_id | @literal_content | @_reference_content |
      | c2  | claim 1      | s1        | user1      | false      | c1         | {}               | {}                  |
      | c8  | hypothesis 1 | s1        | user3      | false      | c7         | {}               | {}                  |

  Scenario Outline: Query by related node
    And a user logged in space s1 and calling getConcepts with these parameters: '{"relations":{"toNodeIds":["lct2"]}}'
    Then query results should look like this
      | _id | name         | _space_id | _author_id | @is_schema | _schema_id | @literal_content | @_reference_content |
      | c2  | claim 1      | s1        | user1      | false      | c1         | {}               | {}                  |
      | c3  | claim 2      | s1        | user2      | false      | c1         | {}               | {}                  |
      | c8  | hypothesis 1 | s1        | user3      | false      | c7         | {}               | {}                  |
