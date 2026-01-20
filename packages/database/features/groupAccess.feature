Feature: Group content access
  User story:
  * As a user of the Obsidian plugin
  * Logged in through a given space's anonymous account
  * I want to be able to create a group including another user outside my space
  * giving that user access to my private content

  Acceptance criteria:
  * The second user should not have access to the content before I publish my content to the group
  * The second user should have access after I publish my content to the group

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1
    And the user user2 opens the Roam plugin in space s2

  Scenario: Creating content
    When Document are added to the database:
      | $id | source_local_id | created    | last_modified | _author_id | _space_id |
      | d1  | ld1             | 2025/01/01 |    2025/01/01 | user1      | s1        |
    And Content are added to the database:
      | $id | source_local_id | _document_id | text  | created    | last_modified | scale    | _author_id | _space_id |
      | ct1 | lct1            | d1           | Claim | 2025/01/01 |    2025/01/01 | document | user1      | s1        |
    Then a user logged in space s1 should see 2 PlatformAccount in the database
    And a user logged in space s1 should see 1 Content in the database
    And a user logged in space s2 should see 2 PlatformAccount in the database
    But a user logged in space s2 should see 0 Content in the database
    When user of space s1 creates group my_group
    And user of space s1 adds space s2 to group my_group
    Then a user logged in space s1 should see 1 Content in the database
    But a user logged in space s2 should see 0 Content in the database
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | my_group     | s1        | lct1            |
    Then a user logged in space s1 should see 1 Content in the database
    Then a user logged in space s2 should see 1 Content in the database
