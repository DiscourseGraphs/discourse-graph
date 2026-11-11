Feature: Shared node round trip
  User story:
  * As a user of the Roam plugin
  * I want a node another space published to read back through discovery as it was published
  * So that what I import from another space is what that space published

  Acceptance criteria:
  * The example Roam node, written with the shared converters, reads back through discovery with the same
  direct content, node type and source identity, and its full content row holds the published body and content type

  Background:
    Given the database is blank
    And the user maparent opens the Roam plugin in space MAPLab
    And the user user2 opens the Roam plugin in space s2
    And user of space MAPLab creates group g1
    And user of space MAPLab adds space s2 to group g1
    And SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | MAPLab    | reader      |

  Scenario: The example Roam node reads back as it was published
    When user maparent publishes the example Roam node to space MAPLab
    Then a user logged in space s2 reads the example Roam node of space MAPLab back through discovery
