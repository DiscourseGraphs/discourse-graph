Feature: Content access
  User story:
  * As a user of the Roam plugin
  * Logged in through a given space's anonymous account
  * I want to be able to upsert content to that space

  Acceptance criteria:
  * The upsert should succeed

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1

  Scenario Outline: Calling the upsert steps separately
    When user user1 upserts these documents to space s1:
      """json
      [
        {
          "source_local_id": "page1_uid",
          "created": "2000/01/01",
          "last_modified": "2001/01/02",
          "author_local_id": "user1"
        }
      ]
      """
    And user user1 upserts this content to space s1:
      """json
      [
        {
          "author_inline": {
            "account_local_id": "user2",
            "name": "maparent"
          },
          "document_inline": {
            "source_local_id": "page1_uid",
            "space_local_id": "s1",
            "created": "2000/01/01",
            "last_modified": "2001/01/02",
            "author_local_id": "user2"
          },
          "source_local_id": "s1",
          "scale": "document",
          "created": "2000/01/01",
          "last_modified": "2001/01/02",
          "text": "Some text"
        },
        {
          "author_local_id": "user2",
          "document_local_id": "page1_uid",
          "space_local_id": "s1",
          "source_local_id": "s2",
          "scale": "document",
          "created": "2000/01/02",
          "last_modified": "2001/01/03",
          "part_of_local_id": "s1",
          "text": "Some subtext"
        },
        {
          "space_local_id": "s1",
          "author_local_id": "user2",
          "document_inline": {
            "source_local_id": "page1_uid",
            "space_local_id": "s1",
            "created": "2000/01/01",
            "last_modified": "2001/01/02",
            "author_local_id": "user2"
          },
          "source_local_id": "s3",
          "scale": "document",
          "created": "2000/01/02",
          "last_modified": "2001/01/03",
          "part_of_local_id": "s2",
          "text": "Some subsubtext",
          "embedding_inline": {
            "model": "openai_text_embedding_3_small_1536",
            "vector": [
              1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
            ]
          }
        }
      ]
      """
    Then a user logged in space s1 should see 3 PlatformAccount in the database
    And a user logged in space s1 should see 3 Content in the database
    And a user logged in space s1 should see 1 ContentEmbedding_openai_text_embedding_3_small_1536 in the database
    And a user logged in space s1 should see 1 Document in the database

  Scenario: Content representations coexist under one semantic variant
    When user user1 upserts this content to space s1:
      """json
      [
        {
          "author_local_id": "user1",
          "document_inline": {
            "source_local_id": "node1",
            "created": "2000/01/01",
            "last_modified": "2001/01/02",
            "author_local_id": "user1"
          },
          "source_local_id": "node1",
          "scale": "document",
          "created": "2000/01/01",
          "last_modified": "2001/01/02",
          "variant": "full",
          "content_type": "text/markdown",
          "text": "# Markdown body"
        },
        {
          "author_local_id": "user1",
          "document_inline": {
            "source_local_id": "node1",
            "created": "2000/01/01",
            "last_modified": "2001/01/02",
            "author_local_id": "user1"
          },
          "source_local_id": "node1",
          "scale": "document",
          "created": "2000/01/01",
          "last_modified": "2001/01/02",
          "variant": "full",
          "content_type": "application/vnd.discourse-graph.atjson+json; version=1",
          "text": "Node title\n\nMarkdown body",
          "metadata": {
            "content": {
              "version": "dg-content-model/v1",
              "title": {
                "text": "Node title",
                "annotations": []
              },
              "body": {
                "text": "Markdown body\n",
                "annotations": [
                  {
                    "type": "block",
                    "start": 0,
                    "end": 14,
                    "attributes": {
                      "blockId": "b1",
                      "depth": 0,
                      "viewType": "paragraph"
                    }
                  }
                ]
              }
            }
          }
        }
      ]
      """
    Then a user logged in space s1 should see 2 Content in the database
    And a user logged in space s1 should see these content rows:
      """json
      [
        {
          "source_local_id": "node1",
          "variant": "full",
          "content_type": "application/vnd.discourse-graph.atjson+json; version=1",
          "text": "Node title\n\nMarkdown body",
          "metadata": {
            "content": {
              "version": "dg-content-model/v1",
              "title": {
                "text": "Node title",
                "annotations": []
              },
              "body": {
                "text": "Markdown body\n",
                "annotations": [
                  {
                    "type": "block",
                    "start": 0,
                    "end": 14,
                    "attributes": {
                      "blockId": "b1",
                      "depth": 0,
                      "viewType": "paragraph"
                    }
                  }
                ]
              }
            }
          }
        },
        {
          "source_local_id": "node1",
          "variant": "full",
          "content_type": "text/markdown",
          "text": "# Markdown body",
          "metadata": {}
        }
      ]
      """

  Scenario: File references target the Markdown full content row
    When user user1 upserts this content to space s1:
      """json
      [
        {
          "author_local_id": "user1",
          "document_inline": {
            "source_local_id": "node-with-file",
            "created": "2000/01/01",
            "last_modified": "2001/01/02",
            "author_local_id": "user1"
          },
          "source_local_id": "node-with-file",
          "scale": "document",
          "created": "2000/01/01",
          "last_modified": "2001/01/02",
          "variant": "full",
          "content_type": "text/markdown",
          "text": "![[asset.png]]"
        }
      ]
      """
    And FileReference are added to the database:
      | source_local_id | _space_id | filepath  | filehash | created    | last_modified |
      | node-with-file  | s1        | asset.png | hash1    | 2000/01/01 | 2001/01/02    |
    Then a user logged in space s1 should see 1 FileReference in the database
