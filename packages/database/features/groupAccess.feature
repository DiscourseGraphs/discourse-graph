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

  Scenario: Invitation-based group membership
    When user of space s1 creates group invite_group
    And user of space s1 creates an invitation for group invite_group
    And user of space s2 accepts the group invitation
    Then user of space s2 should be a member of group invite_group

  Scenario: Sharing content
    When Document are added to the database:
      | $id | source_local_id | created    | last_modified | _author_id | _space_id | content_type          |
      | d1  | ld1             | 2025/01/01 | 2025/01/01    | user1      | s1        | application/roam+json |
      | d2  | ld2             | 2025/01/01 | 2025/01/01    | user1      | s1        | application/roam+json |
    And Content are added to the database:
      | $id | source_local_id | _document_id | text    | created    | last_modified | scale    | _author_id | _space_id | content_type |
      | ct1 | lct1            | d1           | Claim 1 | 2025/01/01 | 2025/01/01    | document | user1      | s1        | text/plain   |
      | ct2 | lct2            | d2           | Claim 2 | 2025/01/01 | 2025/01/01    | document | user1      | s1        | text/plain   |
    Then a user logged in space s1 should see 2 PlatformAccount in the database
    And a user logged in space s1 should see 2 Content in the database
    And a user logged in space s2 should see 2 PlatformAccount in the database
    But a user logged in space s2 should see 0 Content in the database
    When user of space s1 creates group my_group
    And user of space s1 adds space s2 to group my_group
    Then a user logged in space s1 should see 2 Content in the database
    But a user logged in space s2 should see 0 Content in the database
    And a user logged in space s2 should see 1 Space in the database
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | my_group     | s1        | lct1            |
    And SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | my_group     | s1        | partial     |
    Then a user logged in space s1 should see 2 Content in the database
    Then a user logged in space s2 should see 1 Content in the database
    And a user logged in space s2 should see 2 Space in the database

  Scenario: Reader permissions do not allow cross-space edit
    When user of space s1 creates group my_group
    And user of space s1 adds space s2 to group my_group
    And SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | my_group     | s1        | reader      |
      | my_group     | s2        | reader      |
    Then user user2 fails to upsert these documents to space s1:
      """json
      [
        {
          "source_local_id": "s1",
          "created": "2000/01/01",
          "last_modified": "2001/01/02",
          "author_local_id": "user1"
        }
      ]
      """

  Scenario: Edit permissions allow cross-space edit
    When user of space s1 creates group my_group
    And user of space s1 adds space s2 to group my_group
    And SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | my_group     | s1        | editor      |
      | my_group     | s2        | editor      |
    When user user2 upserts these documents to space s1:
      """json
      [
        {
          "source_local_id": "s1",
          "created": "2000/01/01",
          "last_modified": "2001/01/02",
          "author_local_id": "user1"
        }
      ]
      """
    Then a user logged in space s1 should see 1 Document in the database
    And a user logged in space s2 should see 1 Document in the database
