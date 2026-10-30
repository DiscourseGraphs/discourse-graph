Feature: Space table access
  User story:
  * As a user of a plugin
  * Logged in through a given space's anonymous account
  * I want to read the spaces I can reach, with their grants and member accounts, and to manage the spaces I edit
  * And no other user should be able to change them without editor access

  Acceptance criteria:
  * Space returns every space where I have partial access or more
  * SpaceAccess and LocalAccess return the rows of every space where I have reader access or more
  * Editor access to a space allows updating and deleting it, and writing its grants
  * Anyone signed in can create a space

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1
    And the user user2 opens the Roam plugin in space s2
    And the user user3 opens the Roam plugin in space s3
    And user of space s1 creates group g1
    And user of space s1 adds space s2 to group g1

  Scenario: Without a grant, a space sees only itself
    Then a user logged in space s2 should see these rows per space:
      | table       | space | count |
      | Space       | s2    | 1     |
      | SpaceAccess | s2    | 1     |
      | LocalAccess | s2    | 1     |

  Scenario: Reader access shows the space, its grants and its members
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | reader      |
    Then a user logged in space s2 should see these rows per space:
      | table       | space | count |
      | Space       | s1    | 1     |
      | Space       | s2    | 1     |
      | SpaceAccess | s1    | 2     |
      | SpaceAccess | s2    | 1     |
      | LocalAccess | s1    | 1     |
      | LocalAccess | s2    | 1     |
    And a user logged in space s3 should see these rows per space:
      | table       | space | count |
      | Space       | s3    | 1     |
      | SpaceAccess | s3    | 1     |
      | LocalAccess | s3    | 1     |

  Scenario: Partial access shows the space, but not its grants or members
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | partial     |
    Then a user logged in space s2 should see these rows per space:
      | table       | space | count |
      | Space       | s1    | 1     |
      | Space       | s2    | 1     |
      | SpaceAccess | s2    | 1     |
      | LocalAccess | s2    | 1     |

  Scenario: Editor access shows the space, its grants and its members
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | editor      |
    Then a user logged in space s2 should see these rows per space:
      | table       | space | count |
      | Space       | s1    | 1     |
      | Space       | s2    | 1     |
      | SpaceAccess | s1    | 2     |
      | SpaceAccess | s2    | 1     |
      | LocalAccess | s1    | 1     |
      | LocalAccess | s2    | 1     |

  Scenario: A space can write its own grants
    Then a user logged in space s1 should get these write results in space s1:
      | table       | insert  | update  | delete  |
      | SpaceAccess | allowed | allowed | allowed |

  Scenario: A space can update and delete itself
    Then a user logged in space s1 should get these write results in space s1:
      | table | insert  | update  | delete  |
      | Space | allowed | allowed | allowed |

  Scenario: Without a grant, another space can only create spaces
    Then a user logged in space s2 should get these write results in space s1:
      | table       | insert  | update | delete |
      | SpaceAccess | denied  | denied | denied |
      | Space       | allowed | denied | denied |

  Scenario: Reader access does not allow writes to the space or its grants
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | reader      |
    Then a user logged in space s2 should get these write results in space s1:
      | table       | insert  | update | delete |
      | SpaceAccess | denied  | denied | denied |
      | Space       | allowed | denied | denied |

  Scenario: Partial access does not allow writes to the space or its grants
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | partial     |
    Then a user logged in space s2 should get these write results in space s1:
      | table       | insert  | update | delete |
      | SpaceAccess | denied  | denied | denied |
      | Space       | allowed | denied | denied |

  Scenario: Editor access allows writing the space's grants
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | editor      |
    Then a user logged in space s2 should get these write results in space s1:
      | table       | insert  | update  | delete  |
      | SpaceAccess | allowed | allowed | allowed |

  Scenario: Editor access allows updating and deleting the space
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | editor      |
    Then a user logged in space s2 should get these write results in space s1:
      | table | insert  | update  | delete  |
      | Space | allowed | allowed | allowed |
