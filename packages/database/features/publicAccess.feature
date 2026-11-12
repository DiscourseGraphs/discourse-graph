Feature: Public access
  User story:
  * As a user of a plugin
  * I want to publish a node, or a whole space, to everyone
  * So that visitors without a login can read it, its files and its author

  Acceptance criteria:
  * A grant to the everyone pseudo-user shows the resource to clients without a login, and to every logged-in client
  * Visitors see the published node's documents, contents, concepts and files, and nothing unpublished
  * An author visible only through a public grant shows as "anonymous #<id>", not by name or owner
  * A public grant gives no write access, and only an editor of the space can delete it
  * The everyone pseudo-user can never be an editor of a space

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1
    And the user user2 opens the Roam plugin in space s2
    And Document are added to the database:
      | $id | _space_id | _author_id | source_local_id | created    | last_modified |
      | d1  | s1        | user1      | ln1             | 2025/01/01 | 2025/01/01    |
      | d2  | s1        | user1      | ln2             | 2025/01/01 | 2025/01/01    |
    And Content are added to the database:
      | $id | _document_id | _space_id | _author_id | source_local_id | variant | scale    | text    | created    | last_modified |
      | c1  | d1           | s1        | user1      | ln1             | direct  | document | claim 1 | 2025/01/01 | 2025/01/01    |
      | c1f | d1           | s1        | user1      | ln1             | full    | document | claim 1 | 2025/01/01 | 2025/01/01    |
      | c2  | d2           | s1        | user1      | ln2             | direct  | document | claim 2 | 2025/01/01 | 2025/01/01    |
      | c2f | d2           | s1        | user1      | ln2             | full    | document | claim 2 | 2025/01/01 | 2025/01/01    |
    And Concept are added to the database:
      | $id | name  | _space_id | _author_id | source_local_id | created    | last_modified | @is_schema | _schema_id | @literal_content | @reference_content |
      | k1  | Claim | s1        | user1      | lk1             | 2025/01/01 | 2025/01/01    | true       |            | {}               | {}                 |
    And Concept are added to the database:
      | $id | name    | _space_id | _author_id | source_local_id | created    | last_modified | @is_schema | _schema_id | @literal_content | @reference_content |
      | n1  | claim 1 | s1        | user1      | ln1             | 2025/01/01 | 2025/01/01    | false      | k1         | {}               | {}                 |
      | n2  | claim 2 | s1        | user1      | ln2             | 2025/01/01 | 2025/01/01    | false      | k1         | {}               | {}                 |
    And FileReference are added to the database:
      | _space_id | source_local_id | filepath | filehash | created    | last_modified |
      | s1        | ln1             | one.png  | h1       | 2025/01/01 | 2025/01/01    |
      | s1        | ln2             | two.png  | h2       | 2025/01/01 | 2025/01/01    |

  Scenario: Without a public grant, a visitor sees nothing
    Then an anonymous client should see these content view rows in space s1:
      | view | row |
    And an anonymous client should see these concepts in space s1:
      | concept |
    And an anonymous client should see these account names:
      | account | name   |
      | user1   | hidden |

  Scenario: A visitor reads a published node, its files and its author
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | everyone     | s1        | partial     |
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | everyone     | s1        | ln1             |
    Then an anonymous client should see these content view rows in space s1:
      | view               | row     |
      | my_documents       | d1      |
      | my_contents        | c1      |
      | my_contents        | c1f     |
      | my_file_references | one.png |
    And an anonymous client should see these table rows in space s1:
      | table         | row     |
      | Document      | d1      |
      | Content       | c1      |
      | Content       | c1f     |
      | Concept       | n1      |
      | FileReference | one.png |
    And an anonymous client should see these concepts in space s1:
      | concept |
      | n1      |
    And an anonymous client should get these accessible resources:
      | space | source_local_id |
      | s1    | ln1             |
    And an anonymous client should get these file access results:
      | filehash | access |
      | h1       | true   |
      | h2       | false  |
    And an anonymous client should get these file downloads:
      | filehash | access |
      | h1       | true   |
      | h2       | false  |
    And an anonymous client should see these account names:
      | account | name      |
      | user1   | anonymous |
    And an anonymous client can read author_of_concept through my_concepts
    And an anonymous client can read author_of_content through my_contents

  Scenario: A public grant does not count as sharing a space
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | everyone     | s1        | partial     |
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | everyone     | s1        | ln1             |
    And the account of space s2 is called anon2
    Then a user logged in space s2 should see these content view rows in space s1:
      | view               | row     |
      | my_documents       | d1      |
      | my_contents        | c1      |
      | my_contents        | c1f     |
      | my_file_references | one.png |
    And a user logged in space s2 should see these account names:
      | account | name      |
      | user1   | anonymous |
      | user2   | real      |
    And a user logged in space s2 should see these account table rows:
      | table           | rows         |
      | PlatformAccount | anon2, user2 |
    And a user logged in space s1 should see these account names:
      | account | name   |
      | user1   | real   |
      | user2   | hidden |

  Scenario: A space shared through its own grant shows real names
    When user of space s1 creates group g1
    And user of space s1 adds space s2 to group g1
    And SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | everyone     | s1        | partial     |
      | g1           | s1        | partial     |
    Then a user logged in space s2 should see these account names:
      | account | name |
      | user1   | real |

  Scenario: A whole space published to everyone is readable, not writable
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | everyone     | s1        | reader      |
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | everyone     | s1        | ln1             |
    Then an anonymous client should see these content view rows in space s1:
      | view               | row     |
      | my_documents       | d1      |
      | my_documents       | d2      |
      | my_contents        | c1      |
      | my_contents        | c1f     |
      | my_contents        | c2      |
      | my_contents        | c2f     |
      | my_file_references | one.png |
      | my_file_references | two.png |
    And an anonymous client should see these concepts in space s1:
      | concept |
      | k1      |
      | n1      |
      | n2      |
    And an anonymous client should get these file access results:
      | filehash | access |
      | h1       | true   |
      | h2       | true   |
    And a user logged in space s2 should see these account table rows:
      | table           | rows  |
      | AgentIdentifier | user2 |
    And an anonymous client is refused the insert privilege on Content with '{"space_id": 1, "source_local_id": "x", "text": "x"}'
    And a user logged in space s2 should get these write results in space s1:
      | table          | insert | update | delete |
      | FileReference  | denied | denied | denied |
      | Content        | denied | denied | denied |
      | Document       | denied | denied | denied |
      | Concept        | denied | denied | denied |
      | ResourceAccess | denied | denied | denied |
    And a user logged in space s1 should get these write results in space s1:
      | table          | insert  | update  | delete  |
      | ResourceAccess | allowed | allowed | allowed |

  Scenario: The everyone pseudo-user cannot edit a space
    Then SpaceAccess rows like these violate a check constraint:
      | _account_uid | _space_id | permissions |
      | everyone     | s1        | editor      |
