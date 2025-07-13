Feature: Get Context
  User story:
  * As a user of the Roam plugin
  * I want to be able to create the Space, PlatformAccount, PlatformIdentity and SpaceAccess rows
  * In order to access the space information

  Acceptance criteria:
  * After making the various calls, the rows should be available.

  Background:
    Given the database is blank

  Scenario Outline: Calling the getContext steps
    When the user user1 opens the Roam plugin in space abc
    Then the database should contain 2 PlatformAccount
    And the database should contain 1 AgentIdentifier
    And the database should contain 2 SpaceAccess
    #And the database should contain 1 Space
    #And a user logged in space abc should see 1 Space in the database
    And a user logged in space abc should see 1 AgentIdentifier in the database
    And a user logged in space abc should see 2 SpaceAccess in the database
    And a user logged in space abc should see 2 PlatformAccount in the database

  Scenario Outline: Calling getContext again
    When the user user1 opens the Roam plugin in space abc
    Then the database should contain 2 PlatformAccount
    And the database should contain 1 AgentIdentifier
    And the database should contain 2 SpaceAccess
