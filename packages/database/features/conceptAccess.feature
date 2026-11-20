Feature: Concept access
  User story:
  * As a user of a plugin
  * Logged in through a given space's anonymous account
  * I want to read the concepts of my own space, and those shared with me from other spaces
  * In order to sync my space and import from others

  Acceptance criteria:
  * my_concepts returns every concept of a space where I have reader or editor access
  * my_concepts returns only individually shared concepts of a space where I have partial access
  * my_concepts returns nothing from a space I have no access to
  * Overlapping grants through several groups do not duplicate concepts
  * Both for own-space reads and for import listings
  * my_concepts is read-only for clients

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
    And user of space s1 creates group g1
    And user of space s1 adds space s2 to group g1

  Scenario: Without a grant, a space sees only its own concepts
    Then a user logged in space s1 should see these concepts in space s1:
      | concept |
      | k1      |
      | n1      |
      | n2      |
    And a user logged in space s2 should see these concepts in space s2:
      | concept |
      | k2      |
      | n3      |
    And a user logged in space s2 should see these concepts outside space s2:
      | concept |
    And a user logged in space s3 should see these concepts outside space s3:
      | concept |

  Scenario: Reader access shows every concept of the space
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | reader      |
    Then a user logged in space s2 should see these concepts outside space s2:
      | concept |
      | k1      |
      | n1      |
      | n2      |
    And a user logged in space s2 should see these concepts in space s2:
      | concept |
      | k2      |
      | n3      |
    And a user logged in space s3 should see these concepts outside space s3:
      | concept |

  Scenario: Editor access shows every concept of the space
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | editor      |
    Then a user logged in space s2 should see these concepts outside space s2:
      | concept |
      | k1      |
      | n1      |
      | n2      |

  Scenario: Partial access shows only individually shared concepts
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | partial     |
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | g1           | s1        | ln1             |
    Then a user logged in space s2 should see these concepts outside space s2:
      | concept |
      | n1      |
    And a user logged in space s2 should see these concepts in space s1:
      | concept |
      | n1      |
    And a user logged in space s1 should see these concepts in space s1:
      | concept |
      | k1      |
      | n1      |
      | n2      |
    And a user logged in space s3 should see these concepts outside space s3:
      | concept |

  Scenario: Partial and reader grants through two groups do not duplicate concepts
    When user of space s1 creates group g2
    And user of space s1 adds space s2 to group g2
    And SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | partial     |
      | g2           | s1        | reader      |
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | g1           | s1        | ln1             |
    Then a user logged in space s2 should see these concepts outside space s2:
      | concept |
      | k1      |
      | n1      |
      | n2      |

  Scenario: The same concept shared through two groups appears once
    When user of space s1 creates group g2
    And user of space s1 adds space s2 to group g2
    And SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | partial     |
      | g2           | s1        | partial     |
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | g1           | s1        | ln1             |
      | g2           | s1        | ln1             |
    Then a user logged in space s2 should see these concepts outside space s2:
      | concept |
      | n1      |

  Scenario: Clients cannot write through my_concepts, even in their own space
    Then a user logged in space s1 cannot insert concepts through my_concepts
    And a user logged in space s1 cannot update concepts through my_concepts
    And a user logged in space s1 cannot delete concepts through my_concepts
    And a user logged in space s1 should see these concepts in space s1:
      | concept |
      | k1      |
      | n1      |
      | n2      |
