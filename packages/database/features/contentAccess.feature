Feature: Content access
  User story:
  * As a user of the roam plugin
  * Logged in through a given space's anonymous account
  * I want to be able to access the content of that space
  * In order to access the space information
  * Without access to other spaces

  Acceptance criteria:
  * The content rows of a space I belong to should be available to me
  * The content rows of a space should not be available to non-members

  Background:
    Given the database is blank
    And the user user1 opens the roam plugin in space s1
    And the user user2 opens the roam plugin in space s2
    And the user user3 opens the roam plugin in space s1
    And the user user3 opens the roam plugin in space s2
    And Document are added to the database:
      | @id | _space_id | source_local_id | _author_id | created    | last_modified |
      | d1  | s1        | abc             | user1      | 2025/01/01 |    2025/01/01 |
      | d2  | s1        | def             | user2      | 2025/01/01 |    2025/01/01 |
      | d3  | s2        | ghi             | user3      | 2025/01/01 |    2025/01/01 |

  Scenario Outline: Per-space document access
    When the user user1 opens the roam plugin in space s1
    Then the database should contain 3 Document
    And a user logged in space s2 should see 3 Document in the database
    And a user logged in space s1 should see 3 Document in the database
