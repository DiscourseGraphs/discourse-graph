Feature: Table write access
  User story:
  * As a user of a plugin
  * Logged in through a given space's anonymous account
  * I want to write the concepts, documents, contents, file references and resource grants of spaces I edit
  * And no other user should be able to write them without editor access

  Acceptance criteria:
  * Editor access to a space allows inserting, updating and deleting its rows
  * Reader or partial access to a space allows no writes
  * A user can delete a resource grant made to them, even without editor access

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
      | c1f | d1           | s1        | user1      | ln1             | full    | document | claim 1 | 2025/01/01 | 2025/01/01    |
      | c2f | d2           | s1        | user1      | ln2             | full    | document | claim 2 | 2025/01/01 | 2025/01/01    |
    And FileReference are added to the database:
      | _space_id | source_local_id | filepath | filehash | created    | last_modified |
      | s1        | ln1             | one.png  | h1       | 2025/01/01 | 2025/01/01    |
      | s1        | ln2             | two.png  | h2       | 2025/01/01 | 2025/01/01    |
    And user of space s1 creates group g1
    And user of space s1 adds space s2 to group g1

  Scenario: A space can write its own rows
    Then a user logged in space s1 should get these write results in space s1:
      | table          | insert  | update  | delete  |
      | FileReference  | allowed | allowed | allowed |
      | Content        | allowed | allowed | allowed |
      | Document       | allowed | allowed | allowed |
      | Concept        | allowed | allowed | allowed |
      | ResourceAccess | allowed | allowed | allowed |

  Scenario: Without a grant, another space cannot write
    Then a user logged in space s2 should get these write results in space s1:
      | table          | insert | update | delete |
      | FileReference  | denied | denied | denied |
      | Content        | denied | denied | denied |
      | Document       | denied | denied | denied |
      | Concept        | denied | denied | denied |
      | ResourceAccess | denied | denied | denied |

  Scenario: Reader access does not allow writes
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | reader      |
    # A grant to a group the reader is not in: visible through reader access, but not the reader's to delete.
    And user of space s1 creates group g2
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | g2           | s1        | ln1             |
    Then a user logged in space s2 should get these write results in space s1:
      | table          | insert | update | delete |
      | FileReference  | denied | denied | denied |
      | Content        | denied | denied | denied |
      | Document       | denied | denied | denied |
      | Concept        | denied | denied | denied |
      | ResourceAccess | denied | denied | denied |

  Scenario: Partial access allows only deleting a grant made to the user
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | partial     |
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | g1           | s1        | ln1             |
    Then a user logged in space s2 should get these write results in space s1:
      | table          | insert | update | delete  |
      | FileReference  | denied | denied | denied  |
      | Content        | denied | denied | denied  |
      | Document       | denied | denied | denied  |
      | Concept        | denied | denied | denied  |
      | ResourceAccess | denied | denied | allowed |

  Scenario: Editor access allows writes
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | editor      |
    Then a user logged in space s2 should get these write results in space s1:
      | table          | insert  | update  | delete  |
      | FileReference  | allowed | allowed | allowed |
      | Content        | allowed | allowed | allowed |
      | Document       | allowed | allowed | allowed |
      | Concept        | allowed | allowed | allowed |
      | ResourceAccess | allowed | allowed | allowed |
