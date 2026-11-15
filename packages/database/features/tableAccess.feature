Feature: Table access
  User story:
  * As a user of a plugin
  * Logged in through a given space's anonymous account
  * I want to read the concepts, documents, contents and file references of my own space, and those shared with me
  from other spaces, directly from their tables
  * In order to sync my space and import from others without going through the views

  Acceptance criteria:
  * Concept, Document, Content and FileReference return every row of a space where I have reader or editor access
  * They return only the rows of individually shared resources in a space where I have partial access
  * They return nothing from a space I have no access to
  * A resource grant without partial access to its space shows nothing, as in the views

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1
    And the user user2 opens the Roam plugin in space s2
    And the user user3 opens the Roam plugin in space s3
    And Concept are added to the database:
      | $id | name  | _space_id | _author_id | source_local_id | created    | last_modified | @is_schema | _schema_id | @literal_content | @reference_content |
      | k1  | Claim | s1        | user1      | lk1             | 2025/01/01 | 2025/01/01    | true       |            | {}               | {}                 |
      | k2  | Claim | s2        | user2      | lk2             | 2025/01/01 | 2025/01/01    | true       |            | {}               | {}                 |
    And Concept are added to the database:
      | $id | name    | _space_id | _author_id | source_local_id | created    | last_modified | @is_schema | _schema_id | @literal_content | @reference_content |
      | n1  | claim 1 | s1        | user1      | ln1             | 2025/01/01 | 2025/01/01    | false      | k1         | {}               | {}                 |
      | n2  | claim 2 | s1        | user1      | ln2             | 2025/01/01 | 2025/01/01    | false      | k1         | {}               | {}                 |
      | n3  | claim 3 | s2        | user2      | ln3             | 2025/01/01 | 2025/01/01    | false      | k2         | {}               | {}                 |
    And Document are added to the database:
      | $id | _space_id | _author_id | source_local_id | created    | last_modified |
      | d1  | s1        | user1      | ln1             | 2025/01/01 | 2025/01/01    |
      | d2  | s1        | user1      | ln2             | 2025/01/01 | 2025/01/01    |
      | d3  | s2        | user2      | ln3             | 2025/01/01 | 2025/01/01    |
    And Content are added to the database:
      | $id | _document_id | _space_id | _author_id | source_local_id | variant | scale    | text    | created    | last_modified |
      | c1  | d1           | s1        | user1      | ln1             | direct  | document | claim 1 | 2025/01/01 | 2025/01/01    |
      | c1f | d1           | s1        | user1      | ln1             | full    | document | claim 1 | 2025/01/01 | 2025/01/01    |
      | c2  | d2           | s1        | user1      | ln2             | direct  | document | claim 2 | 2025/01/01 | 2025/01/01    |
      | c2f | d2           | s1        | user1      | ln2             | full    | document | claim 2 | 2025/01/01 | 2025/01/01    |
      | c3  | d3           | s2        | user2      | ln3             | direct  | document | claim 3 | 2025/01/01 | 2025/01/01    |
      | c3f | d3           | s2        | user2      | ln3             | full    | document | claim 3 | 2025/01/01 | 2025/01/01    |
    And FileReference are added to the database:
      | _space_id | source_local_id | filepath  | filehash | created    | last_modified |
      | s1        | ln1             | one.png   | h1       | 2025/01/01 | 2025/01/01    |
      | s1        | ln2             | two.png   | h2       | 2025/01/01 | 2025/01/01    |
      | s2        | ln3             | three.png | h3       | 2025/01/01 | 2025/01/01    |
    And user of space s1 creates group g1
    And user of space s1 adds space s2 to group g1

  Scenario: Without a grant, a space sees only its own rows
    Then a user logged in space s1 should see these table rows in space s1:
      | table         | row     |
      | Concept       | k1      |
      | Concept       | n1      |
      | Concept       | n2      |
      | Document      | d1      |
      | Document      | d2      |
      | Content       | c1      |
      | Content       | c1f     |
      | Content       | c2      |
      | Content       | c2f     |
      | FileReference | one.png |
      | FileReference | two.png |
    And a user logged in space s2 should see these table rows in space s2:
      | table         | row       |
      | Concept       | k2        |
      | Concept       | n3        |
      | Document      | d3        |
      | Content       | c3        |
      | Content       | c3f       |
      | FileReference | three.png |
    And a user logged in space s2 should see these table rows outside space s2:
      | table | row |
    And a user logged in space s3 should see these table rows outside space s3:
      | table | row |

  Scenario: Reader access shows every row of the space
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | reader      |
    Then a user logged in space s2 should see these table rows outside space s2:
      | table         | row     |
      | Concept       | k1      |
      | Concept       | n1      |
      | Concept       | n2      |
      | Document      | d1      |
      | Document      | d2      |
      | Content       | c1      |
      | Content       | c1f     |
      | Content       | c2      |
      | Content       | c2f     |
      | FileReference | one.png |
      | FileReference | two.png |
    And a user logged in space s3 should see these table rows outside space s3:
      | table | row |

  Scenario: Editor access shows every row of the space
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | editor      |
    Then a user logged in space s2 should see these table rows outside space s2:
      | table         | row     |
      | Concept       | k1      |
      | Concept       | n1      |
      | Concept       | n2      |
      | Document      | d1      |
      | Document      | d2      |
      | Content       | c1      |
      | Content       | c1f     |
      | Content       | c2      |
      | Content       | c2f     |
      | FileReference | one.png |
      | FileReference | two.png |

  Scenario: Partial access shows only the rows of individually shared resources
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | partial     |
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | g1           | s1        | ln1             |
    Then a user logged in space s2 should see these table rows outside space s2:
      | table         | row     |
      | Concept       | n1      |
      | Document      | d1      |
      | Content       | c1      |
      | Content       | c1f     |
      | FileReference | one.png |
    And a user logged in space s1 should see these table rows in space s1:
      | table         | row     |
      | Concept       | k1      |
      | Concept       | n1      |
      | Concept       | n2      |
      | Document      | d1      |
      | Document      | d2      |
      | Content       | c1      |
      | Content       | c1f     |
      | Content       | c2      |
      | Content       | c2f     |
      | FileReference | one.png |
      | FileReference | two.png |
    And a user logged in space s3 should see these table rows outside space s3:
      | table | row |

  Scenario: A resource grant without partial access to its space shows nothing
    When ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | g1           | s1        | ln1             |
    Then a user logged in space s2 should see these table rows outside space s2:
      | table | row |
