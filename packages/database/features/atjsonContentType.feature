Feature: ATJSON content type storage
  User story:
  * As a Discourse Graphs app writer
  * I want to store multiple representations of the same content slice
  * So canonical ATJSON can be written without replacing Markdown

  Background:
    Given the database is blank
    And the user user1 opens the Roam plugin in space s1

  Scenario: Markdown and ATJSON rows coexist for one full content slice
    When user user1 upserts this content to space s1:
      """json
      [
        {
          "author_local_id": "user1",
          "document_inline": {
            "source_local_id": "node1",
            "created": "2026/01/01",
            "last_modified": "2026/01/02",
            "author_local_id": "user1"
          },
          "source_local_id": "node1",
          "scale": "document",
          "created": "2026/01/01",
          "last_modified": "2026/01/02",
          "variant": "full",
          "text": "# Markdown content"
        },
        {
          "author_local_id": "user1",
          "document_inline": {
            "source_local_id": "node1",
            "created": "2026/01/01",
            "last_modified": "2026/01/02",
            "author_local_id": "user1"
          },
          "source_local_id": "node1",
          "scale": "document",
          "created": "2026/01/01",
          "last_modified": "2026/01/02",
          "variant": "full",
          "content_type": "application/vnd.discourse-graph.atjson+json; version=1",
          "text": "Canonical text",
          "metadata": {
            "content": {
              "version": "dg-content-model/v1",
              "title": {
                "text": "Node 1",
                "annotations": []
              },
              "body": {
                "text": "Canonical text\n",
                "annotations": [
                  {
                    "type": "block",
                    "start": 0,
                    "end": 15,
                    "attributes": {
                      "blockId": "block-1",
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
    And a user logged in space s1 should see these content representation rows:
      | source_local_id | variant | content_type                                           | text               |
      | node1           | full    | application/vnd.discourse-graph.atjson+json; version=1 | Canonical text     |
      | node1           | full    | text/markdown                                          | # Markdown content |
