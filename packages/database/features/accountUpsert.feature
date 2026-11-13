Feature: Adding accounts to a space
  User story:
  * As a user of a plugin
  * Logged in through a given space's anonymous account
  * I can add the accounts of my space's authors to my space
  * But nobody without editor access to my space can change its accounts

  Acceptance criteria:
  * Clients that are not logged in cannot call the account functions
  * Users with no access or reader access to a space cannot add or rename accounts through it
  * Adding an account that has an owner gives that owner no access to the space

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1
    And the user user2 opens the Roam plugin in space s2

  Scenario: Clients that are not logged in cannot add accounts
    Then a client that is not logged in fails to upsert these accounts to space s1:
      """json
      [{ "account_local_id": "user1", "name": "renamed" }]
      """
    And the account user1 should be named "user1"

  Scenario: Users with no access to a space cannot add accounts to it
    Then user user2 fails to upsert these accounts to space s1:
      """json
      [
        { "account_local_id": "user1", "name": "renamed" },
        { "account_local_id": "intruder", "name": "intruder" }
      ]
      """
    And the account user1 should be named "user1"
    And a user logged in space s1 should see 2 PlatformAccount in the database

  Scenario: Users with reader access to a space cannot add accounts to it
    When user of space s1 creates group my_group
    And user of space s1 adds space s2 to group my_group
    And SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | my_group     | s1        | reader      |
    Then user user2 fails to upsert these accounts to space s1:
      """json
      [
        { "account_local_id": "user1", "name": "renamed" },
        { "account_local_id": "intruder", "name": "intruder" }
      ]
      """
    And the account user1 should be named "user1"
    And a user logged in space s1 should see 2 PlatformAccount in the database

  Scenario: Adding an account that has an owner grants the owner no access
    When user user1 adds the account of space s2 to space s1
    Then a user logged in space s1 should see 3 PlatformAccount in the database
    And a user logged in space s2 should see 1 Space in the database
