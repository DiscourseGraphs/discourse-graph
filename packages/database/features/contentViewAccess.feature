Feature: Content view access
  User story:
  * As a user of a plugin
  * Logged in through a given space's anonymous account
  * I want to read the documents, contents, file references and embeddings of my own space, and those shared with me
  from other spaces
  * In order to sync my space and import from others

  Acceptance criteria:
  * my_documents, my_contents, my_file_references and the embedding view return every row of a space where I have reader
  or editor access
  * They return only the rows of individually shared resources in a space where I have partial access
  * They return nothing from a space I have no access to
  * Overlapping grants through several groups do not duplicate rows
  * The embedding view never returns obsolete embeddings
  * Both for own-space reads and for import listings
  * my_documents, my_contents and my_file_references are read-only for clients

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1
    And the user user2 opens the Roam plugin in space s2
    And the user user3 opens the Roam plugin in space s3
    And Document are added to the database:
      | $id | _space_id | _author_id | source_local_id | created    | last_modified |
      | d1  | s1        | user1      | ln1             | 2025/01/01 | 2025/01/01    |
      | d2  | s1        | user1      | ln2             | 2025/01/01 | 2025/01/01    |
      | d3  | s2        | user2      | ln3             | 2025/01/01 | 2025/01/01    |
    And Content are added to the database:
      | $id | _document_id | _space_id | _author_id | source_local_id | variant | scale    | text    | created    | last_modified |
      | c1  | d1           | s1        | user1      | ln1             | direct  | document | claim 1 | 2025/01/01 | 2025/01/01    |
      | c1f | d1           | s1        | user1      | ln1             | full    | document | claim 1 | 2025/01/01 | 2025/01/01    |
      | c2  | d2           | s1        | user1      | ln2             | direct  | document | claim 2 | 2025/01/01 | 2025/01/01    |
      | c2f | d2           | s1        | user1      | ln2             | full    | document | claim 2 | 2025/01/01 | 2025/01/01    |
      | c3  | d3           | s2        | user2      | ln3             | direct  | document | claim 3 | 2025/01/01 | 2025/01/01    |
      | c3f | d3           | s2        | user2      | ln3             | full    | document | claim 3 | 2025/01/01 | 2025/01/01    |
    And FileReference are added to the database:
      | _space_id | source_local_id | filepath  | filehash | created    | last_modified |
      | s1        | ln1             | one.png   | h1       | 2025/01/01 | 2025/01/01    |
      | s1        | ln2             | two.png   | h2       | 2025/01/01 | 2025/01/01    |
      | s2        | ln3             | three.png | h3       | 2025/01/01 | 2025/01/01    |
    And these contents have embeddings:
      | content | obsolete |
      | c1      | false    |
      | c1f     | true     |
      | c2      | false    |
      | c3      | false    |
    And user of space s1 creates group g1
    And user of space s1 adds space s2 to group g1

  Scenario: Without a grant, a space sees only its own rows
    Then a user logged in space s1 should see these content view rows in space s1:
      | view                                                          | row     |
      | my_documents                                                  | d1      |
      | my_documents                                                  | d2      |
      | my_contents                                                   | c1      |
      | my_contents                                                   | c1f     |
      | my_contents                                                   | c2      |
      | my_contents                                                   | c2f     |
      | my_file_references                                            | one.png |
      | my_file_references                                            | two.png |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c1      |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c2      |
    And a user logged in space s2 should see these content view rows in space s2:
      | view                                                          | row       |
      | my_documents                                                  | d3        |
      | my_contents                                                   | c3        |
      | my_contents                                                   | c3f       |
      | my_file_references                                            | three.png |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c3        |
    And a user logged in space s2 should see these content view rows in space s1:
      | view | row |
    And a user logged in space s2 should see these content view rows outside space s2:
      | view | row |
    And a user logged in space s3 should see these content view rows outside space s3:
      | view | row |

  Scenario: Reader access shows every row of the space
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | reader      |
    Then a user logged in space s2 should see these content view rows outside space s2:
      | view                                                          | row     |
      | my_documents                                                  | d1      |
      | my_documents                                                  | d2      |
      | my_contents                                                   | c1      |
      | my_contents                                                   | c1f     |
      | my_contents                                                   | c2      |
      | my_contents                                                   | c2f     |
      | my_file_references                                            | one.png |
      | my_file_references                                            | two.png |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c1      |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c2      |
    And a user logged in space s2 should see these content view rows in space s1:
      | view                                                          | row     |
      | my_documents                                                  | d1      |
      | my_documents                                                  | d2      |
      | my_contents                                                   | c1      |
      | my_contents                                                   | c1f     |
      | my_contents                                                   | c2      |
      | my_contents                                                   | c2f     |
      | my_file_references                                            | one.png |
      | my_file_references                                            | two.png |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c1      |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c2      |
    And a user logged in space s3 should see these content view rows outside space s3:
      | view | row |

  Scenario: Editor access shows every row of the space
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | editor      |
    Then a user logged in space s2 should see these content view rows outside space s2:
      | view                                                          | row     |
      | my_documents                                                  | d1      |
      | my_documents                                                  | d2      |
      | my_contents                                                   | c1      |
      | my_contents                                                   | c1f     |
      | my_contents                                                   | c2      |
      | my_contents                                                   | c2f     |
      | my_file_references                                            | one.png |
      | my_file_references                                            | two.png |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c1      |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c2      |
    And a user logged in space s2 should see these content view rows in space s1:
      | view                                                          | row     |
      | my_documents                                                  | d1      |
      | my_documents                                                  | d2      |
      | my_contents                                                   | c1      |
      | my_contents                                                   | c1f     |
      | my_contents                                                   | c2      |
      | my_contents                                                   | c2f     |
      | my_file_references                                            | one.png |
      | my_file_references                                            | two.png |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c1      |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c2      |

  Scenario: Partial access shows only the rows of individually shared resources
    When SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | partial     |
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | g1           | s1        | ln1             |
    Then a user logged in space s2 should see these content view rows outside space s2:
      | view                                                          | row     |
      | my_documents                                                  | d1      |
      | my_contents                                                   | c1      |
      | my_contents                                                   | c1f     |
      | my_file_references                                            | one.png |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c1      |
    And a user logged in space s2 should see these content view rows in space s1:
      | view                                                          | row     |
      | my_documents                                                  | d1      |
      | my_contents                                                   | c1      |
      | my_contents                                                   | c1f     |
      | my_file_references                                            | one.png |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c1      |
    And a user logged in space s1 should see these content view rows in space s1:
      | view                                                          | row     |
      | my_documents                                                  | d1      |
      | my_documents                                                  | d2      |
      | my_contents                                                   | c1      |
      | my_contents                                                   | c1f     |
      | my_contents                                                   | c2      |
      | my_contents                                                   | c2f     |
      | my_file_references                                            | one.png |
      | my_file_references                                            | two.png |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c1      |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c2      |
    And a user logged in space s3 should see these content view rows outside space s3:
      | view | row |

  Scenario: Partial and reader grants through two groups do not duplicate rows
    When user of space s1 creates group g2
    And user of space s1 adds space s2 to group g2
    And SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | partial     |
      | g2           | s1        | reader      |
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | g1           | s1        | ln1             |
    Then a user logged in space s2 should see these content view rows outside space s2:
      | view                                                          | row     |
      | my_documents                                                  | d1      |
      | my_documents                                                  | d2      |
      | my_contents                                                   | c1      |
      | my_contents                                                   | c1f     |
      | my_contents                                                   | c2      |
      | my_contents                                                   | c2f     |
      | my_file_references                                            | one.png |
      | my_file_references                                            | two.png |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c1      |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c2      |
    And a user logged in space s2 should see these content view rows in space s1:
      | view                                                          | row     |
      | my_documents                                                  | d1      |
      | my_documents                                                  | d2      |
      | my_contents                                                   | c1      |
      | my_contents                                                   | c1f     |
      | my_contents                                                   | c2      |
      | my_contents                                                   | c2f     |
      | my_file_references                                            | one.png |
      | my_file_references                                            | two.png |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c1      |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c2      |

  Scenario: The same resource shared through two groups appears once
    When user of space s1 creates group g2
    And user of space s1 adds space s2 to group g2
    And SpaceAccess are added to the database:
      | _account_uid | _space_id | permissions |
      | g1           | s1        | partial     |
      | g2           | s1        | partial     |
    And ResourceAccess are added to the database:
      | _account_uid | _space_id | source_local_id |
      | g1           | s1        | ln1             |
      | g2           | s1        | ln1             |
    Then a user logged in space s2 should see these content view rows outside space s2:
      | view                                                          | row     |
      | my_documents                                                  | d1      |
      | my_contents                                                   | c1      |
      | my_contents                                                   | c1f     |
      | my_file_references                                            | one.png |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c1      |
    And a user logged in space s2 should see these content view rows in space s1:
      | view                                                          | row     |
      | my_documents                                                  | d1      |
      | my_contents                                                   | c1      |
      | my_contents                                                   | c1f     |
      | my_file_references                                            | one.png |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c1      |

  Scenario: Clients cannot write through the single-table content views, even in their own space
    Then a user logged in space s1 cannot insert documents through my_documents
    And a user logged in space s1 cannot update documents through my_documents
    And a user logged in space s1 cannot delete documents through my_documents
    And a user logged in space s1 cannot insert contents through my_contents
    And a user logged in space s1 cannot update contents through my_contents
    And a user logged in space s1 cannot delete contents through my_contents
    And a user logged in space s1 cannot insert file references through my_file_references
    And a user logged in space s1 cannot update file references through my_file_references
    And a user logged in space s1 cannot delete file references through my_file_references
    And a user logged in space s1 should see these content view rows in space s1:
      | view                                                          | row     |
      | my_documents                                                  | d1      |
      | my_documents                                                  | d2      |
      | my_contents                                                   | c1      |
      | my_contents                                                   | c1f     |
      | my_contents                                                   | c2      |
      | my_contents                                                   | c2f     |
      | my_file_references                                            | one.png |
      | my_file_references                                            | two.png |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c1      |
      | my_contents_with_embedding_openai_text_embedding_3_small_1536 | c2      |
