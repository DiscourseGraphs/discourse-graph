# A few examples of using upsert_authors / upsert_document / upsert_content / upsert_concept etc.

In general, for external references such as `author_id`, you can either:

1. use the database id as is: `author_id`
2. Use the platform id, with the name transformed such as `author_local_id`
3. Put the data inline as a subobject, with the name transformed such as `author_inline`

Note that embeddings are always inline.

Here are complete examples:

```typescript
import type {
  LocalAccountDataInput,
  LocalDocumentDataInput,
  LocalContentDataInput,
  LocalConceptDataInput,
} from "@repo/database/inputTypes";
import type { Json } from "@repo/database/dbTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";

const demoCode = async (client: DGSupabaseClient) => {
  const accounts: LocalAccountDataInput[] = [
    {
      account_local_id: "sR22zZ470dNPkIf9PpjQXXdTBjG2",
      name: "maparent",
    },
  ];

  const docs: LocalDocumentDataInput[] = [
    {
      source_local_id: "page1_uid",
      created: "2000/01/01",
      last_modified: "2001/01/02",
      author_local_id: "sR22zZ470dNPkIf9PpjQXXdTBjG2",
    },
  ];

  const contents: LocalContentDataInput[] = [
    {
      author_local_id: "sR22zZ470dNPkIf9PpjQXXdTBjG2",
      author_inline: {
        account_local_id: "sR22zZ470dNPkIf9PpjQXXdTBjG2",
        name: "maparent",
      },
      document_inline: {
        source_local_id: "page1_uid",
        created: "2000/01/01",
        last_modified: "2001/01/02",
        author_local_id: "sR22zZ470dNPkIf9PpjQXXdTBjG2",
      },
      source_local_id: "a_roam_uid",
      scale: "document",
      created: "2000/01/01",
      last_modified: "2001/01/02",
      text: "[[CLM]] a claim",
    },
    {
      author_local_id: "sR22zZ470dNPkIf9PpjQXXdTBjG2",
      document_local_id: "page1_uid",
      source_local_id: "a_roam_uid2",
      scale: "section",
      created: "2000/01/02",
      last_modified: "2001/01/03",
      part_of_local_id: "a_roam_uid",
      text: "Some subsection",
    },
    {
      author_local_id: "sR22zZ470dNPkIf9PpjQXXdTBjG2",
      document_inline: docs[0],
      source_local_id: "a_roam_uid3",
      scale: "paragraph",
      created: "2000/01/02",
      last_modified: "2001/01/03",
      part_of_local_id: "a_roam_uid2",
      text: "Some paragraph",
      embedding_inline: {
        model: "openai_text_embedding_3_small_1536",
        vector: [0], // assume that the vector has the requisite length
      },
    },
  ];

  const concepts: LocalConceptDataInput[] = [
    {
      author_local_id: "sR22zZ470dNPkIf9PpjQXXdTBjG2",
      source_local_id: "a_roam_uid3",
      created: "2000/01/01",
      last_modified: "2001/01/02",
      name: "Some subsubtext",
      schema_represented_by_local_id: "known_claim_schema_local_id",
    },
  ];

  // Base scenario: insert references in order of dependencies
  // 1. upsert accounts.
  {
    const { data, error } = await client.rpc("upsert_accounts_in_space", {
      space_id_: 12,
      accounts,
    });
    if (error) console.error(error);
    console.log(data);
  }

  // 2. upsert documents.
  {
    const { data, error } = await client.rpc("upsert_documents", {
      v_space_id: 12,
      data: docs as Json,
    });
    if (error) console.error(error);
    console.log(data);
  }

  // 3. content
  {
    const { data, error } = await client.rpc("upsert_content", {
      v_space_id: 12,
      data: contents as Json,
      v_creator_id: 63,
    });
    if (error) console.error(error);
    console.log(data);
  }

  // 4. upsert concept
  {
    const { data, error } = await client.rpc("upsert_concepts", {
      v_space_id: 12,
      data: concepts as Json,
    });
    if (error) console.error(error);
    console.log(data);
  }

  // Variant: if all content is known to also be a document, you can upsert both as if it were a single object
  const page_contents: LocalContentDataInput[] = [
    {
      author_local_id: "sR22zZ470dNPkIf9PpjQXXdTBjG2",
      source_local_id: "a_page_uid2",
      created: "2000/01/02",
      last_modified: "2001/01/03",
      text: "Some other page",
    },
  ];

  {
    const { data, error } = await client.rpc("upsert_content", {
      v_space_id: 12,
      data: page_contents as Json,
      v_creator_id: 63,
      content_as_document: true,
    });
    if (error) console.error(error);
    console.log(data);
  }

  // Nesting: you can nest information. Nested types can inherit information from the type above.
  // Eg 1: upserting content with nested documents and authors
  const contentWithNestedDoc: LocalContentDataInput[] = [
    {
      author_local_id: "sR22zZ470dNPkIf9PpjQXXdTBjG2",
      source_local_id: "a_page_uid3",
      created: "2000/01/02",
      scale: "document",
      last_modified: "2001/01/03",
      text: "Yet another page",
      author_inline: {
        account_local_id: "sR22zZ470dNPkIf9PpjQXXdTBjG2",
        name: "maparent",
      },
      document_inline: {
        source_local_id: "a_page_uid3",
        // note that created, last_modified and author_inline will be inherited
      },
    },
  ];
  {
    const { data, error } = await client.rpc("upsert_content", {
      v_space_id: 12,
      data: contentWithNestedDoc as Json,
      v_creator_id: 63,
    });
    if (error) console.error(error);
    console.log(data);
  }

  // eg 2: Nesting multiple contents in a concept
  const conceptsWithNestedContent: LocalConceptDataInput[] = [
    {
      author_local_id: "sR22zZ470dNPkIf9PpjQXXdTBjG2",
      source_local_id: "a_roam_uid4",
      created: "2000/01/01",
      last_modified: "2001/01/02",
      name: "[[CLM]] another claim",
      schema_represented_by_local_id: "known_claim_schema_local_id",
      author_inline: {
        account_local_id: "sR22zZ470dNPkIf9PpjQXXdTBjG2",
        name: "maparent",
      },
      document_inline: {
        source_local_id: "a_page_uid3",
        // note that created, last_modified and author_inline will be inherited
      },
      contents_inline: [
        {
          text: "The claim page contents",
          variant: "full",
          // here, source_local_id, document_inline, author_inline, created, last_modified are inherited
        },
        {
          text: "[[CLM]] another claim",
          variant: "direct",
          embedding_inline: {
            model: "openai_text_embedding_3_small_1536",
            vector: [0], // assume that the vector has the requisite length
            // again source_local_id etc. are inherited
          },
          // same variables are intherited
        },
      ],
    },
  ];

  {
    const { data, error } = await client.rpc("upsert_concepts", {
      v_space_id: 12,
      data: conceptsWithNestedContent as Json,
    });
    if (error) console.error(error);
    console.log(data);
  }
};
```
