Feature: Access through a linked row
  User story:
  * As a user of a plugin
  * Logged in through a given space's anonymous account
  * I want contributors, embeddings and stored files to follow the access of the row they belong to
  * And no other user should reach them without that access

  Acceptance criteria:
  * Contributors and embeddings are visible exactly when their concept or content is visible
  * Embeddings can be written with editor access to the space of their content, and not with less
  * A stored file is accessible when one of its file references is visible
  * A resource grant without partial access to its space gives access to nothing

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1
    And the user user2 opens the Roam plugin in space s2
    And Concept are added to the database:
      | $id | name    | _space_id | _author_id | source_local_id | created    | last_modified | @is_schema | @literal_content | @reference_content |
      | n1  | claim 1 | s1        | user1      | ln1             | 2025/01/01 | 2025/01/01    | true       | {}               | {}                 |
      | n2  | claim 2 | s1        | user1      | ln2             | 2025/01/01 | 2025/01/01    | true       | {}               | {}                 |
    And Document are added to the database:
      | $id | _space_id | _author_id | source_local_id | created    | last_modified |
      | d1  | s1        | user1      | ln1             | 2025/01/01 | 2025/01/01    |
      | d2  | s1        | user1      | ln2             | 2025/01/01 | 2025/01/01    |
    And Content are added to the database:
      | $id | _document_id | _space_id | _author_id | source_local_id | variant | scale    | text    | created    | last_modified |
      | c1  | d1           | s1        | user1      | ln1             | direct  | document | claim 1 | 2025/01/01 | 2025/01/01    |
      | c1f | d1           | s1        | user1      | ln1             | full    | document | claim 1 | 2025/01/01 | 2025/01/01    |
      | c2f | d2           | s1        | user1      | ln2             | full    | document | claim 2 | 2025/01/01 | 2025/01/01    |
    And FileReference are added to the database:
      | _space_id | source_local_id | filepath | filehash | created    | last_modified |
      | s1        | ln1             | one.png  | h1       | 2025/01/01 | 2025/01/01    |
      | s1        | ln2             | two.png  | h2       | 2025/01/01 | 2025/01/01    |
    And concept_contributors are added to the database:
      | _concept_id | _contributor_id |
      | n1          | user1           |
      | n2          | user1           |
    And content_contributors are added to the database:
      | _content_id | _contributor_id |
      | c1f         | user1           |
      | c2f         | user1           |
    And these contents have embeddings:
      | content | obsolete |
      | c1f     | false    |
      | c2f     | false    |
    And user of space s1 creates group g1
    And user of space s1 adds space s2 to group g1

  Scenario: A space reaches its own linked rows, and another space without a grant reaches nothing
    Then a user logged in space s1 should see these linked rows:
      | table                | row |
      | concept_contributors | n1  |
      | concept_contributors | n2  |
      | content_contributors | c1f |
      | content_contributors | c2f |
      | embedding            | c1f |
      | embedding            | c2f |
    And a user logged in space s1 should get these file access results:
      | filehash | access |
      | h1       | true   |
      | h2       | true   |
    And a user logged in space s1 should get these embedding write results:
      | new | existing | insert  | update  | delete  |
      | c1  | c1f      | allowed | allowed | allowed |
    And a user logged in space s2 should see these linked rows:
      | table | row |
    And a user logged in space s2 should get these file access results:
      | filehash | access |
      | h1       | false  |
      | h2       | false  |
    And a user logged in space s2 should get these embedding write results:
      | new | existing | insert | update | delete |
      | c1  | c2f      | denied | denied | denied |

  Scenario: Reader access reaches every linked row but cannot write embeddings
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | reader      |
    Then a user logged in space s2 should see these linked rows:
      | table                | row |
      | concept_contributors | n1  |
      | concept_contributors | n2  |
      | content_contributors | c1f |
      | content_contributors | c2f |
      | embedding            | c1f |
      | embedding            | c2f |
    And a user logged in space s2 should get these file access results:
      | filehash | access |
      | h1       | true   |
      | h2       | true   |
    And a user logged in space s2 should get these embedding write results:
      | new | existing | insert | update | delete |
      | c1  | c2f      | denied | denied | denied |

  Scenario: Editor access reaches every linked row and can write embeddings
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | editor      |
    Then a user logged in space s2 should see these linked rows:
      | table                | row |
      | concept_contributors | n1  |
      | concept_contributors | n2  |
      | content_contributors | c1f |
      | content_contributors | c2f |
      | embedding            | c1f |
      | embedding            | c2f |
    And a user logged in space s2 should get these file access results:
      | filehash | access |
      | h1       | true   |
      | h2       | true   |
    And a user logged in space s2 should get these embedding write results:
      | new | existing | insert  | update  | delete  |
      | c1  | c2f      | allowed | allowed | allowed |

  Scenario: Partial access reaches only the linked rows of individually shared resources
    When user of space s1 creates group g2
    And SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | partial     |
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | g1           | s1        | ln1             |
      | g2           | s1        | ln2             |
    Then a user logged in space s2 should see these linked rows:
      | table                | row |
      | concept_contributors | n1  |
      | content_contributors | c1f |
      | embedding            | c1f |
    And a user logged in space s2 should get these file access results:
      | filehash | access |
      | h1       | true   |
      | h2       | false  |
    And a user logged in space s2 should get these embedding write results:
      | new | existing | insert | update | delete |
      | c1  | c1f      | denied | denied | denied |

  Scenario: A resource grant without partial access to its space reaches nothing
    When ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | g1           | s1        | ln1             |
    Then a user logged in space s2 should see these linked rows:
      | table | row |
    And a user logged in space s2 should get these file access results:
      | filehash | access |
      | h1       | false  |
      | h2       | false  |
