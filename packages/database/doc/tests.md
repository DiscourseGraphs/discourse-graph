# Designing cucumber tests

Cucumber is a harness for the gherkin language, allowing to make tests more legible. The steps are defined as regexp in `features/step-definitions/stepdefs.ts`. Currently, we assume the database is running with `turbo dev` in another terminal.

Some of test steps were defined to clear the database (`Given the database is blank`) or to put arbitrary data in the tables (`{word} are added to the database:`) which expects the name of a table as argument, and a markdown table for the table data.

The latter step requires some further explanations:

A lot of database objects use foreign keys, so we need to refer to numeric database identifiers. Those are defined by the database. To allow this to work, we have a pseudo-column called `$id`, which is a string alias that corresponds to the database numeric `id`. Make sure each value in that column is unique. We keep a dictionary of those aliases to the database numeric `id` in cucumber. When interpreting the table, if any other column is prefixed by a `_`, we will recursively search for strings and from the alias set and replace them with the appropriate database ids. Note that inserts are made in bulk, so you may need to break up your inserts according to dependencies. For example:

- Adding a schema first
  `And Concept are added to the database:`

  | $id | name | @is_schema |
  | alias1 | Claim | true |

- Then a concept referring to the schema
  `And Concept are added to the database:`
  | $id | name | @is_schema | \_schema_id |
  | alias2 | claim 1 | false | alias1 |

Also, cucumber treats all columns as strings; if they contain a non-string literal (essentially number, boolean or JSON) you can use the `@` prefix in the column name so the cell value will be parsed as json before sending to the database. (`@` comes before `_` if both are used.)

Other steps that require explanation:

- `a user logged in space {word} and calling getConcepts with these parameters: {string}`
- `Then query results should look like this`

This comes in pairs: The results from the query (whose parameters are defined as json) are checked against a table, using the same syntax as above. Only the columns defined are checked for equivalence.

- `the user {word} opens the {word} plugin in space {word}`.

This both creates the space and an account tied to that space. Because tying spaces and accounts goes through an edge function, it is the only good way to do both.
