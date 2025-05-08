# example...

Content:

* (nt1pgid) discourse-graphs/nodes/Claim
* (nt2pgid) discourse-graphs/nodes/Hypothesis
* (et1pgid) discourse-graphs/edges/OpposedBy
  * (anyid1) roles
    * (et1r1bkid) source
    * (et1r2bkid) target
  * (anyid2) arity: 2
* (hyp1pgid) [HYP] Some hypothesis
* (clm1pgid) [CLM] Some claim
* (somepgid) Some page
  * (hyp1refbkid) a block referring to [[HYP] Some hypothesis]
    * (opp1bkid) OpposedBy
      * (clm1refbkid) a block referring to [[CLM] Some Claim]

Documents:

+----+-----------------+
| id | source_local_id |
+----+-----------------+
| 1  | nt1pgid         |
| 2  | nt2pgid         |
| 3  | et1pgid         |
| 22 | hyp1pgid        |
| 23 | clm1pgid        |
| 4  | somepgid        |
+----+-----------------+

Content:

+----+-------------+-------------+----------+---------------+----------------------------------------------+
| id | source_local_id | page_id | scale    | represents_id | text                                         |
+----+-------------+-------------+----------+---------------+----------------------------------------------+
| 5  | nt1pgid         | 1       | document | 16            | discourse-graphs/nodes/Claim                 |
| 6  | nt2pgid         | 2       | document | 17            | discourse-graphs/nodes/Hypothesis            |
| 7  | et1pgid         | 3       | document | 18            | discourse-graphs/edges/OpposedBy             |
| 8  | somepgid        | 4       | document |               | Some page                                    |
| 24 | hyp1pgid        | 22      | document | 20            | [HYP] Some hypothesis                        |
| 25 | clm1pgid        | 23      | document | 19            | [HYP] Some claim                             |
| 9  | hyp1refbkid     | 4       | block    |               | a block referring to [[HYP] Some hypothesis] |
| 10 | opp1bkid        | 4       | block    | 21            | OpposedBy                                    |
| 11 | clm1refbkid     | 4       | block    |               | a block referring to [[CLM] Some claim]      |
| 12 | anyid1          | 3       | block    |               | roles                                        |
| 13 | et1r1bkid       | 3       | block    |               | source                                       |
| 14 | et1r2bkid       | 3       | block    |               | target                                       |
| 15 | anyid2          | 3       | block    |               | arity: 2                                     |
+----+-------------+-------------+----------+---------------+----------------------------------------------+

Concept:

+----+-----------+-------+--------+-----------------------+-----------...
| id | is_schema | arity | schema | name                  | content
+----+-----------+-------+--------+-----------------------+-----------...
| 16 | true      | 0     |        | Claim                 | {}
| 17 | true      | 0     |        | Hypothesis            | {}
| 18 | true      | 2     |        | Opposed-by            |
    { "roles": ["source", "target"], "representation": ["source", "sourceref", "target", "targetref", "predicate"] }
| 19 | false     | 0     |        | [CLM] Some claim      | {}
| 20 | false     | 0     |        | [HYP] Some hypothesis | {}
| 21 | false     | 2     | 18     | OpposedBy             |
    { "concepts": {"source": 19, "target": 20}, "occurences":
      [{"sourceref": 11, "targetref": 9, "source": 25, "target": 24, "predicate": 10 }] }
+----+-----------+-------+--------+-----------------------+-----------...

Note: Open question whether the occurence structure matters, and whether it should be materialized in another table.
(I would tend to say yes to both.)

ContentLink

+--------+--------+
| source | target |
+--------+--------+
| 9      | 24     |
| 11     | 25     |
+--------+--------+

Note: I would probably create a sub-Content for the link text and use this as source.
OR use a char_start, char_end.
