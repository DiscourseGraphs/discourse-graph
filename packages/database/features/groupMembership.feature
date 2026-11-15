Feature: Group membership
  User story:
  * As a user of a plugin
  * Logged in through a given space's anonymous account
  * I can share my space with a group
  * But nobody can join a group without an admin's consent

  Acceptance criteria:
  * A user cannot join another user's id as if it were a group
  * Nobody can join a group after its last member leaves

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1
    And the user user2 opens the Roam plugin in space s2

  Scenario: A reader of a space cannot join its editor as a group to gain editor access
    When user of space s1 creates group my_group
    And user of space s1 adds space s2 to group my_group
    And SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | my_group     | s1        | reader      |
    Then user of space s2 fails to join an editor of space s1 as a group
    And user user2 fails to upsert these documents to space s1:
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

  Scenario: Nobody can join a group after its last member leaves
    When user of space s1 creates group my_group
    And user of space s1 leaves group my_group
    Then user of space s2 fails to add itself to group my_group
