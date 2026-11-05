Feature: Account write access
  User story:
  * As a user of a plugin
  * Logged in through a given space's anonymous account
  * I want to keep the accounts of my space's authors up to date
  * But nobody should claim an account, or tie it to a space, through a plugin login

  Acceptance criteria:
  * A plugin login cannot set the owner of an account, or change what identifies it
  * A plugin login creates accounts only through the account functions, not by inserting them
  * Account names stay editable by editors of the account's space and by the account's owner
  * A space's account list can only be written by editors of that space

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1
    And the user user2 opens the Roam plugin in space s2
    And the user user3 opens the Roam plugin in space s3
    And user of space s1 creates group g1
    And user of space s1 adds space s2 to group g1
    And SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | editor      |
    And the account of space s2 is called anon2

  Scenario: An editor cannot claim an account or change what identifies it
    Then a user logged in space s2 should get these account write results:
      | operation | account | column           | value     | result |
      | update    | user1   | dg_account       | own login | denied |
      | update    | user1   | agent_type       | anonymous | denied |
      | update    | user1   | platform         | Obsidian  | denied |
      | update    | user1   | account_local_id | changed   | denied |
      | insert    | user4   | dg_account       | own login | denied |

  Scenario: An editor cannot insert an unowned account directly
    Then a user logged in space s2 should get these account write results:
      | operation | account | column | value | result |
      | insert    | user4   | name   | user4 | denied |

  Scenario: Account names stay editable
    Then a user logged in space s2 should get these account write results:
      | operation | account | column | value   | result  |
      | update    | user1   | name   | renamed | allowed |
      | update    | user2   | name   | renamed | allowed |
      | update    | anon2   | name   | renamed | allowed |
      | update    | user3   | name   | renamed | denied  |

  Scenario: An editor can still add accounts to a space through the account functions
    When user user2 upserts these accounts to space s1:
      """json
      [{ "account_local_id": "user4", "name": "user4" }]
      """
    Then a user logged in space s1 should see 3 PlatformAccount in the database

  Scenario: Only editors of a space can add an account to it or move one into it
    Then a user logged in space s2 should get these space membership write results:
      | operation | account | space | new space | result  |
      | insert    | user1   | s3    |           | denied  |
      | insert    | anon2   | s3    |           | denied  |
      | update    | user1   | s1    | s3        | denied  |
      | insert    | user1   | s2    |           | allowed |
      | insert    | anon2   | s1    |           | allowed |
      | delete    | user1   | s1    |           | allowed |

  # Through the API these deletes were refused even before the delete policy checked the space:
  # a filter makes the select policy hide the rows, and safeupdate rejects a delete without one.
  Scenario: Only editors of a space can remove an account from it
    Given LocalAccess are added to the database:
      | _account_id | _space_id |
      | user1       | s3        |
      | anon2       | s3        |
    Then a user logged in space s2 should get these space membership write results:
      | operation         | account | space | new space | result |
      | delete            | user1   | s3    |           | denied |
      | delete            | anon2   | s3    |           | denied |
      | unfiltered delete | user1   | s3    |           | denied |
      | unfiltered delete | anon2   | s3    |           | denied |
