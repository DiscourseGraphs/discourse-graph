Feature: Concept upsert
  User story:
  * As a user of the Roam plugin
  * Logged in through a given space's anonymous account
  * I want to be able to upsert concepts to that space

  Acceptance criteria:
  * The upsert should succeed

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1

  Scenario Outline: Calling the upsert steps together
    When user user1 upserts these concepts to space s1:
      """
      [
        {
          "name": "Claim",
          "author_local_id": "user2",
          "source_local_id": "ns1",
          "created": "2000/01/01",
          "last_modified": "2001/01/02",
          "is_schema": true,
          "contents_inline": [
            {
              "author_inline": {
                "account_local_id": "user2",
                "name": "maparent"
              },
              "document_inline": {
                "source_local_id": "page1_uid",
                "created": "2000/01/01",
                "last_modified": "2001/01/02",
                "author_local_id": "user2"
              },
              "source_local_id": "s1",
              "scale": "document",
              "created": "2000/01/01",
              "last_modified": "2001/01/02",
              "text": "Some text"
            }
          ]
        },
        {
          "name": "A Claim",
          "author_local_id": "user2",
          "source_local_id": "n1",
          "created": "2000/01/03",
          "last_modified": "2001/01/04",
          "is_schema": false,
          "schema_represented_by_local_id": "ns1",
          "contents_inline": [
            {
              "author_local_id": "user2",
              "document_local_id": "page1_uid",
              "source_local_id": "n1",
              "scale": "document",
              "created": "2000/01/02",
              "last_modified": "2001/01/03",
              "part_of_local_id": "s1",
              "text": "Some subtext"
            }
          ]
        },
        {
          "name": "Another Claim",
          "author_local_id": "user2",
          "source_local_id": "n2",
          "created": "2000/01/03",
          "last_modified": "2001/01/04",
          "is_schema": false,
          "schema_represented_by_local_id": "ns1",
          "contents_inline": [
            {
              "author_local_id": "user2",
              "document_inline": {
                "source_local_id": "page1_uid",
                "created": "2000/01/01",
                "last_modified": "2001/01/02",
                "author_local_id": "user2"
              },
              "source_local_id": "n2",
              "scale": "document",
              "created": "2000/01/02",
              "last_modified": "2001/01/03",
              "part_of_local_id": "n1",
              "text": "Some subsubtext",
              "embedding_inline": {
                "model": "openai_text_embedding_3_small_1536",
                "vector": [
                  1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0, 0
                ]
              }
            }
          ]
        },
        {
          "name": "supports",
          "author_local_id": "user2",
          "source_local_id": "rts1",
          "created": "2000/01/04",
          "last_modified": "2001/01/05",
          "is_schema": true,
          "literal_content": {
            "roles": ["source", "destination"]
          },
          "local_reference_content": {
            "source": "ns1",
            "destination": "ns1"
          }
        },
        {
          "name": "a supports relation",
          "author_local_id": "user2",
          "source_local_id": "r1",
          "schema_represented_by_local_id": "rts1",
          "created": "2000/01/04",
          "last_modified": "2001/01/05",
          "is_schema": false,
          "local_reference_content": {
            "source": "n1",
            "destination": "n2"
          }
        }
      ]
      """
    Then a user logged in space s1 should see 5 Concept in the database
    And a user logged in space s1 should see 3 Content in the database
    And a user logged in space s1 and calling getConcepts with these parameters: '{"scope":{"type":"all"}}'
    And query results should look like this
      | _id | @is_relation | @arity | _schema_id | @_reference_content                   |
      | n1  | false        | 0      | ns1        | {}                                    |
      | n2  | false        | 0      | ns1        | {}                                    |
      | r1  | true         | 2      | rts1       | {"destination": "n2", "source": "n1"} |

    And a user logged in space s1 and calling getConcepts with these parameters: '{"scope":{"schemas":true},"fields":{"concept":["source_local_id","id","is_relation","is_schema","reference_content","literal_content"]}}'
    Then query results should look like this
      | _id  | @is_relation | @arity | @_reference_content                     | @literal_content                   |
      | ns1  | false        | 0      | {}                                      | {}                                 |
      | rts1 | true         | 2      | {"destination": "ns1", "source": "ns1"} | {"roles":["source","destination"]} |

  # A client that knows nothing of a field must not erase what another client stored:
  # in upsert_concepts, a value absent from the input leaves the stored one alone.
  Scenario: Fields absent from an upsert keep their stored value
    Given user user1 upserts these concepts to space s1:
      """
      [
        {
          "name": "Evidence",
          "author_local_id": "user1",
          "source_local_id": "ns1",
          "created": "2000/01/01",
          "last_modified": "2001/01/02",
          "is_schema": true
        },
        {
          "name": "A Source",
          "author_local_id": "user1",
          "source_local_id": "n2",
          "schema_represented_by_local_id": "ns1",
          "created": "2000/01/03",
          "last_modified": "2001/01/04"
        },
        {
          "name": "An Evidence",
          "author_local_id": "user1",
          "source_local_id": "n1",
          "schema_represented_by_local_id": "ns1",
          "description": "a description",
          "epistemic_status": "certain",
          "created": "2000/01/03",
          "last_modified": "2001/01/04",
          "literal_content": {
            "roles": ["source"]
          },
          "local_reference_content": {
            "sourceDocument": "n2"
          }
        }
      ]
      """
    # A second client rewrites the same node, sending only what it knows about
    When user user1 upserts these concepts to space s1:
      """
      [
        {
          "name": "An Evidence, renamed",
          "source_local_id": "n1",
          "created": "2000/01/03",
          "last_modified": "2002/02/02"
        }
      ]
      """
    Then a user logged in space s1 and calling getConcepts with these parameters: '{"scope":{"type":"nodes","nodeIds":["n1"]},"fields":{"concepts":["id","source_local_id","name","description","epistemic_status","author_id","schema_id","literal_content","reference_content"]}}'
    And query results should look like this
      | _id | name                 | description   | epistemic_status | _author_id | _schema_id | @literal_content      | @_reference_content      |
      | n1  | An Evidence, renamed | a description | certain          | user1      | ns1        | {"roles": ["source"]} | {"sourceDocument": "n2"} |

    # The stored values are still clearable, by saying so explicitly
    When user user1 upserts these concepts to space s1:
      """
      [
        {
          "name": "An Evidence, renamed",
          "source_local_id": "n1",
          "description": "",
          "epistemic_status": "unknown",
          "created": "2000/01/03",
          "last_modified": "2003/03/03",
          "literal_content": {},
          "local_reference_content": {}
        }
      ]
      """
    Then a user logged in space s1 and calling getConcepts with these parameters: '{"scope":{"type":"nodes","nodeIds":["n1"]},"fields":{"concepts":["id","source_local_id","description","epistemic_status","literal_content","reference_content"]}}'
    And query results should look like this
      | _id | description | epistemic_status | @literal_content | @_reference_content |
      | n1  |             | unknown          | {}               | {}                  |

  # The link to a schema is the exception: absent keeps it, and it is erased by
  # declaring the concept to be a schema itself.
  Scenario: Declaring a concept to be a schema erases its link to a schema
    Given user user1 upserts these concepts to space s1:
      """
      [
        {
          "name": "Evidence",
          "author_local_id": "user1",
          "source_local_id": "ns1",
          "created": "2000/01/01",
          "last_modified": "2001/01/02",
          "is_schema": true
        },
        {
          "name": "An Evidence",
          "author_local_id": "user1",
          "source_local_id": "n1",
          "schema_represented_by_local_id": "ns1",
          "created": "2000/01/03",
          "last_modified": "2001/01/04"
        }
      ]
      """
    When user user1 upserts these concepts to space s1:
      """
      [
        {
          "name": "An Evidence",
          "source_local_id": "n1",
          "created": "2000/01/03",
          "last_modified": "2002/02/02",
          "is_schema": true
        }
      ]
      """
    Then a user logged in space s1 and calling getConcepts with these parameters: '{"scope":{"schemas":true},"fields":{"concepts":["id","source_local_id","is_schema","schema_id","author_id"]}}'
    And query results should look like this
      | _id | @is_schema | _schema_id | _author_id |
      | ns1 | true       |            | user1      |
      | n1  | true       |            | user1      |
