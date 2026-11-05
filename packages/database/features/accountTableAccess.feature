Feature: Account table access
  User story:
  * As a user of a plugin
  * Logged in through a given space's anonymous account
  * I want to see and keep up to date the accounts of the spaces I share
  * And nobody else should see or change them without access to those spaces

  Acceptance criteria:
  * Partial access to a space shows its accounts
  * Reader access also shows their identifiers and the space's account list
  * Editors of a space can write the identifiers of its unowned accounts, and delete those accounts
  * An account's owner can write its identifiers and delete it

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1
    And the user user2 opens the Roam plugin in space s2
    And the user user3 opens the Roam plugin in space s3
    And user of space s1 creates group g1
    And user of space s1 adds space s2 to group g1
    And the account of space s1 is called anon1
    And the account of space s2 is called anon2

  Scenario: Without shared access, a space sees only its own account rows
    Then a user logged in space s2 should see these account table rows:
      | table           | rows         |
      | PlatformAccount | anon2, user2 |
      | AgentIdentifier | user2        |
      | LocalAccess     | user2@s2     |

  Scenario: Partial access shows a space's accounts, not their identifiers
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | partial     |
    Then a user logged in space s2 should see these account table rows:
      | table           | rows                |
      | PlatformAccount | anon2, user1, user2 |
      | AgentIdentifier | user2               |
      | LocalAccess     | user2@s2            |

  Scenario: Reader access also shows identifiers and the space's account list
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | reader      |
    Then a user logged in space s2 should see these account table rows:
      | table           | rows                |
      | PlatformAccount | anon2, user1, user2 |
      | AgentIdentifier | user1, user2        |
      | LocalAccess     | user1@s1, user2@s2  |

  Scenario: Editors write the identifiers of their spaces' unowned accounts
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | editor      |
    Then a user logged in space s2 should get these identifier write results:
      | operation | account | result  |
      | insert    | user1   | allowed |
      | update    | user1   | allowed |
      | delete    | user1   | allowed |
      | insert    | user2   | allowed |
      | insert    | anon2   | allowed |
      | insert    | user3   | denied  |
      | update    | user3   | denied  |
      | delete    | user3   | denied  |

  Scenario: Readers cannot write identifiers
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | reader      |
    Then a user logged in space s2 should get these identifier write results:
      | operation | account | result |
      | insert    | user1   | denied |
      | update    | user1   | denied |
      | delete    | user1   | denied |

  # An account with identifiers cannot be deleted by any client: the AgentIdentifier foreign key
  # has no ON DELETE action. These accounts have none, so the policy decides.
  Scenario: Editors delete their spaces' unowned accounts, and owners their own
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | editor      |
    And PlatformAccount are added to the database:
      | $id     | name    | platform | account_local_id |
      | author1 | author1 | Roam     | author1          |
      | author3 | author3 | Roam     | author3          |
    And LocalAccess are added to the database:
      | _account_id | _space_id |
      | author1     | s1        |
      | author3     | s3        |
      | anon1       | s1        |
    Then a user logged in space s2 should get these account write results:
      | operation | account | column | value | result  |
      | delete    | anon1   |        |       | denied  |
      | delete    | author3 |        |       | denied  |
      | delete    | author1 |        |       | allowed |
      | delete    | anon2   |        |       | allowed |

  Scenario: Editors cannot write an account in their space that someone owns
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | editor      |
    And LocalAccess are added to the database:
      | _account_id | _space_id |
      | anon1       | s1        |
    And AgentIdentifier are added to the database:
      | _account_id | value             | identifier_type | trusted |
      | anon1       | anon1@example.com | email           | false   |
    Then a user logged in space s2 should get these identifier write results:
      | operation | account | result |
      | insert    | anon1   | denied |
      | update    | anon1   | denied |
      | delete    | anon1   | denied |
    And a user logged in space s2 should get these account write results:
      | operation | account | column | value   | result |
      | update    | anon1   | name   | renamed | denied |
    And a user logged in space s2 should get these space membership write results:
      | operation | account | space | new space | result |
      | delete    | anon1   | s1    |           | denied |

  # Reader access makes the identifiers visible, which an update or delete needs, and the owner branch of the policy must allow the write.
  Scenario: Owners write the identifiers of their own account
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | reader      |
    And LocalAccess are added to the database:
      | _account_id | _space_id |
      | anon2       | s1        |
    And AgentIdentifier are added to the database:
      | _account_id | value             | identifier_type | trusted |
      | anon2       | anon2@example.com | email           | false   |
    Then a user logged in space s2 should get these identifier write results:
      | operation | account | result  |
      | insert    | anon2   | allowed |
      | update    | anon2   | allowed |
      | delete    | anon2   | allowed |

  Scenario: Readers cannot delete accounts
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | reader      |
    And PlatformAccount are added to the database:
      | $id     | name    | platform | account_local_id |
      | author1 | author1 | Roam     | author1          |
    And LocalAccess are added to the database:
      | _account_id | _space_id |
      | author1     | s1        |
    Then a user logged in space s2 should get these account write results:
      | operation | account | column | value | result |
      | delete    | author1 |        |       | denied |
