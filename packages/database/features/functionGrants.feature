Feature: Function grants
  User story:
  * As a maintainer of the database
  * I want each function to be executable only by the roles that call it
  * So that a SECURITY DEFINER function cannot be called outside the flow it was written for

  Acceptance criteria:
  * Clients without a login get a permission error calling functions that only logged-in clients use
  * Clients without a login can still call the functions that their reads need
  * No client can call a function that only triggers use
  * Clients without a login cannot write to the contributor tables
  * The triggers still run when a logged-in client deletes rows

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1

  Scenario: Clients without a login cannot call functions reserved for logged-in clients
    Then an anonymous client gets a permission error calling file_exists with '{"hashvalue": "h1"}'
    And an anonymous client gets a permission error calling create_secret_token with '{"v_payload": {}}'
    And an anonymous client gets a permission error calling in_group with '{"group_id_": "00000000-0000-0000-0000-000000000000"}'
    And an anonymous client gets a permission error calling is_last_local_reference with '{"space_id_": 1, "source_local_id_": "ln1"}'
    And an anonymous client gets a permission error calling my_platform_account_ids with '{}'
    And an anonymous client gets a permission error calling account_ids_in_shared_spaces with '{"access_level": "reader"}'
    And an anonymous client gets a permission error calling in_space with '{"space_id": 1}'
    And an anonymous client can call my_space_ids with '{}'
    And an anonymous client can call get_secret_token with '{"token": "no such token"}'

  Scenario: Clients without a login cannot write to the contributor tables
    Then an anonymous client is refused the insert privilege on concept_contributors with '{"concept_id": 1, "contributor_id": 1}'
    And an anonymous client is refused the insert privilege on content_contributors with '{"content_id": 1, "contributor_id": 1}'

  Scenario: Logged-in clients cannot call functions that only triggers use
    Then a user logged in space s1 gets a permission error calling is_last_local_reference with '{"space_id_": 1, "source_local_id_": "ln1"}'
    And a user logged in space s1 can call file_exists with '{"hashvalue": "h1"}'
    And a user logged in space s1 can call my_platform_account_ids with '{}'
    And a user logged in space s1 can call account_ids_in_shared_spaces with '{"access_level": "reader"}'

  Scenario: Deleting file references and content still runs the triggers
    Given Document are added to the database:
      | $id | _space_id | _author_id | source_local_id | created    | last_modified |
      | d1  | s1        | user1      | ln1             | 2025/01/01 | 2025/01/01    |
    And Content are added to the database:
      | $id | _document_id | _space_id | _author_id | source_local_id | variant | scale    | text    | created    | last_modified |
      | c1  | d1           | s1        | user1      | ln1             | direct  | document | claim 1 | 2025/01/01 | 2025/01/01    |
      | c1f | d1           | s1        | user1      | ln1             | full    | document | claim 1 | 2025/01/01 | 2025/01/01    |
    And FileReference are added to the database:
      | _space_id | source_local_id | filepath | filehash | created    | last_modified |
      | s1        | ln1             | one.png  | h1       | 2025/01/01 | 2025/01/01    |
    And user of space s1 creates group g1
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | g1           | s1        | ln1             |
    When a user logged in space s1 deletes the FileReference rows with filehash "h1"
    Then the database should contain 1 file_gc
    When a user logged in space s1 deletes the Document rows with source_local_id "ln1"
    Then the database should contain 0 ResourceAccess
