# example...

Content:

* (nt1pgid) discourse-graphs/nodes/Claim
* (nt2pgid) discourse-graphs/nodes/Hypothesis
* (et1pgid) discourse-graphs/edges/OpposedBy
  * (anyid1) roles
    * (et1r1bkid) source
    * (et1r2bkid) target
  * (anyid2) arity: 2
* (somepgid) Some page
  * (hyp1bkid) [HYP] Some hypothesis
    * (opp1bkid) OpposedBy
      * (clm1bkid) [CLM] Some Claim

Documents:

+----+-----------------+
| id | source_local_id |
+----+-----------------+
| 1  | nt1pgid         |
| 2  | nt2pgid         |
| 3  | et1pgid         |
| 4  | somepgid        |
+----+-----------------+

Content:

+----+-------------+-------------+----------+---------------+-----------------------------------+
| id | source_local_id | page_id | scale    | represents_id | text                              |
+----+-------------+-------------+----------+---------------+-----------------------------------+
| 5  | nt1pgid         | 1       | document | 16            | discourse-graphs/nodes/Claim      |
| 6  | nt2pgid         | 2       | document | 17            | discourse-graphs/nodes/Hypothesis |
| 7  | et1pgid         | 3       | document | 18            | discourse-graphs/edges/OpposedBy  |
| 8  | somepgid        | 4       | document |               | Some page                         |
| 9  | hyp1bkid        | 4       | block    | 20            | [HYP] Some hypothesis             |
| 10 | opp1bkid        | 4       | block    | 21            | OpposedBy                         |
| 11 | clm1bkid        | 4       | block    | 19            | [CLM] Some claim                  |
| 12 | anyid1          | 3       | block    |               | roles                             |
| 13 | et1r1bkid       | 3       | block    |               | source                            |
| 14 | et1r2bkid       | 3       | block    |               | target                            |
| 15 | anyid2          | 3       | block    |               | arity: 2                          |
+----+-------------+-------------+----------+---------------+-----------------------------------+

Concept:

+----+-----------+-------+-----------------------+-----------...
| id | is_schema | arity | name                  | content
+----+-----------+-------+-----------------------+-----------...
| 16 | true      | 0     | Claim                 | {}
| 17 | true      | 0     | Hypothesis            | {}
| 18 | true      | 2     | Opposed-by            | { "roles": ["source", "target"] }
| 19 | false     | 0     | [CLM] Some Claim      | {}
| 20 | false     | 0     | [HYP] Some Hypothesis | {}
| 21 | false     | 2     | OpposedBy             | { "concepts": {"source": 19, "target": 21}, "occurences": [{"source": 11, target: 9 }] }
+----+-----------+-------+-----------------------+-----------...
