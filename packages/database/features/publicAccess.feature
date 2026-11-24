Feature: Read explicitly published nodes without signing in

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1
    And the user user2 opens the Roam plugin in space s2
    And Document are added to the database:
      | $id | _space_id | _author_id | source_local_id | created    | last_modified |
      | d1  | s1        | user1      | ln1             | 2025/01/01 | 2025/01/01    |
      | d2  | s1        | user1      | ln2             | 2025/01/01 | 2025/01/01    |
    And Content are added to the database:
      | $id | _document_id | _space_id | _author_id | source_local_id | variant | scale    | text         | created    | last_modified |
      | c1  | d1           | s1        | user1      | ln1             | direct  | document | claim 1      | 2025/01/01 | 2025/01/01    |
      | c1f | d1           | s1        | user1      | ln1             | full    | document | full claim 1 | 2025/01/01 | 2025/01/01    |
      | c2  | d2           | s1        | user1      | ln2             | direct  | document | claim 2      | 2025/01/01 | 2025/01/01    |
      | c2f | d2           | s1        | user1      | ln2             | full    | document | claim 2      | 2025/01/01 | 2025/01/01    |
    And Concept are added to the database:
      | $id | name  | _space_id | _author_id | source_local_id | created    | last_modified | @is_schema | _schema_id | @literal_content | @reference_content |
      | k1  | Claim | s1        | user1      | lk1             | 2025/01/01 | 2025/01/01    | true       |            | {}               | {}                 |
    And Concept are added to the database:
      | $id | name    | _space_id | _author_id | source_local_id | created    | last_modified | @is_schema | _schema_id | @literal_content | @reference_content |
      | n1  | claim 1 | s1        | user1      | ln1             | 2025/01/01 | 2025/01/01    | false      | k1         | {}               | {}                 |
      | n2  | claim 2 | s1        | user1      | ln2             | 2025/01/01 | 2025/01/01    | false      | k1         | {}               | {}                 |

  Scenario: A signed-out visitor needs both grants for the same node
    Then a public viewer should see nodes "" in space s1
    When ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | everyone     | s1        | ln1             |
    Then a public viewer should see nodes "" in space s1
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | everyone     | s1        | partial     |
    Then a public viewer should see nodes "ln1" in space s1
    And an anonymous client is refused the insert privilege on Content with '{"space_id": 1, "source_local_id": "x", "text": "x"}'
    And a user logged in space s2 should get these write results in space s1:
      | table          | insert | update | delete |
      | Concept        | denied | denied | denied |
      | Content        | denied | denied | denied |
      | ResourceAccess | denied | denied | denied |
    When the public space grant for s1 is revoked
    Then a public viewer should see nodes "" in space s1
