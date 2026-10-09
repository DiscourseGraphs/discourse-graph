Feature: Read-only access views
  User story:
  * As a user of a plugin
  * Logged in through a given space's anonymous account
  * I can read spaces and accounts through the my_spaces and my_accounts views
  * But I cannot write through them, since such writes would bypass the tables' RLS

  Acceptance criteria:
  * Inserts, updates and deletes through my_spaces and my_accounts fail with insufficient privilege
  * Reads through both views still work

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1

  Scenario: Clients cannot write through my_spaces, even for their own space
    Then a user logged in space s1 cannot insert spaces through my_spaces
    And a user logged in space s1 cannot update spaces through my_spaces
    And a user logged in space s1 cannot delete spaces through my_spaces
    And a user logged in space s1 should see 1 my_spaces in the database

  Scenario: Clients cannot write through my_accounts, even for their own accounts
    Then a user logged in space s1 cannot insert accounts through my_accounts
    And a user logged in space s1 cannot update accounts through my_accounts
    And a user logged in space s1 cannot delete accounts through my_accounts
    And a user logged in space s1 should see 2 my_accounts in the database
