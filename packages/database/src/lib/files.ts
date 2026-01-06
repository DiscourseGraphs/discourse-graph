import type { DGSupabaseClient } from "./client";

const ASSETS_BUCKET_NAME = "assets";

export const addFile = async ({
  client, spaceId, contentLocalId, fname, mimetype, created, lastModified, content
}:{
  client: DGSupabaseClient,
  spaceId: number,
  contentLocalId: string,
  fname: string,
  mimetype: string,
  created: Date,
  lastModified: Date,
  content: ArrayBuffer
}) => {
  const contentResult = await client.from("Content").select("id").eq("space_id", spaceId).eq("local_id", contentLocalId).single();
  if (contentResult.error) throw contentResult.error;
  const contentId = contentResult.data.id;
  // This assumes the content fits in memory.
  const uint8Array = new Uint8Array(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', uint8Array);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashvalue = hashArray.map((h) => h.toString(16).padStart(2, '0')).join('');
  const lookForDup = await client.rpc("file_exists",{hashvalue})
  if (lookForDup.error) throw lookForDup.error;
  const exists = lookForDup.data;
  if (!exists) {
    const uploadResult = await client.storage.from(ASSETS_BUCKET_NAME).upload(hashvalue, content, {contentType: mimetype});
    if (uploadResult.error)
      throw uploadResult.error;
  }
  const frefResult = await client.from("FileReference").insert({
    space_id: spaceId,
    content_id: contentId,
    filepath: fname,
    filehash: hashvalue,
    created: created.toISOString(),
    last_modified: lastModified.toISOString()
  });
  if (frefResult.error) throw frefResult.error;
}
