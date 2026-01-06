import type { DGSupabaseClient } from "./client";

const ASSETS_BUCKET_NAME = "assets";

export const addFile = async ({
  client, spaceId, contentId, fname, mimetype, created, lastModified, content
}:{
  client: DGSupabaseClient,
  spaceId: number,
  contentId: number,
  fname: string,
  mimetype: string,
  created: Date,
  lastModified: Date,
  content: ArrayBuffer
}): Promise<void> => {
  // This assumes the content fits in memory.
  const uint8Array = new Uint8Array(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', uint8Array);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashvalue = hashArray.map((h) => h.toString(16).padStart(2, '0')).join('');
  const lookForDup = await client.rpc("file_exists",{hashvalue})
  if (lookForDup.error) throw lookForDup.error;
  const exists = lookForDup.data;
  if (!exists) {
    // we should use upsert here for sync issues, but we get obscure rls errors.
    const uploadResult = await client.storage.from(ASSETS_BUCKET_NAME).upload(hashvalue, content, {contentType: mimetype});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (uploadResult.error && String((uploadResult.error as Record<string, any>).statusCode) !== "409")
      throw uploadResult.error;
  }
  // not doing an upsert because it does not update on conflict
  const frefResult = await client.from("FileReference").insert({
    /* eslint-disable @typescript-eslint/naming-convention */
    space_id: spaceId,
    content_id: contentId,
    last_modified: lastModified.toISOString(),
    /* eslint-enable @typescript-eslint/naming-convention */
    filepath: fname,
    filehash: hashvalue,
    created: created.toISOString()
  });

  if (frefResult.error) {
    if (frefResult.error.code === "23505") {
      const updateResult = await client.from("FileReference").update({
        /* eslint-disable @typescript-eslint/naming-convention */
        space_id: spaceId,
        last_modified: lastModified.toISOString(),
        /* eslint-enable @typescript-eslint/naming-convention */
        filehash: hashvalue,
        created: created.toISOString()
      }).eq("content_id", contentId).eq("filepath", fname);
      if (updateResult.error) throw updateResult.error;
    } else
      throw frefResult.error;
  }
}
