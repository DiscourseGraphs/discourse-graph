export const fetchSupabaseEntity = async (entityType: string, payload: any) => {
  console.log(
    `fetchSupabaseEntity: Syncing ${entityType} with payload:`,
    payload,
  );

  const baseInsertApiUrl =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000/api/supabase/insert"
      : "https://discourse-graph-git-store-in-supabase-discourse-graphs.vercel.app/api/supabase/insert";
  // process.env.NODE_ENV === "development"
  //   ? "http://localhost:3000/api/supabase/insert"
  //   :
  // : "https://discoursegraphs.com/api/supabase/insert";

  const fullApiUrl = `${baseInsertApiUrl}/${entityType}`;
  console.log(`fetchSupabaseEntity: Calling ${fullApiUrl}`);

  const response = await fetch(fullApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `fetchSupabaseEntity: Failed to get/create ${entityType} at ${fullApiUrl}. Status: ${response.status}. Error:`,
      errorText,
      "Payload:",
      payload,
    );
    throw new Error(
      `Failed to sync ${entityType}: ${response.status} ${errorText}`,
    );
  }
  const responseData = await response.json();
  console.log(
    `fetchSupabaseEntity: Successfully synced ${entityType}. Response:`,
    responseData,
  );
  return responseData;
};

export async function postBatchToSupabaseApi<T>(
  apiPath: string,
  batchPayload: T[],
): Promise<any> {
  const baseUrl =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000/api/supabase/insert"
      : "https://discourse-graph-git-store-in-supabase-discourse-graphs.vercel.app/api/supabase/insert";
  // process.env.NODE_ENV === "development"
  //   ? "http://localhost:3000/api/supabase/insert"
  //   :
  // : "https://discoursegraphs.com/api/supabase/insert";

  const fullApiUrl = `${baseUrl}/${apiPath}`;

  console.log(
    `postBatchToSupabaseApi: Sending batch of ${batchPayload.length} items to ${fullApiUrl}`,
  );

  const response = await fetch(fullApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(batchPayload),
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      // If response is not JSON, use text
      errorData = {
        error: `Server responded with ${response.status}: ${await response.text()}`,
      };
    }
    console.error(
      `postBatchToSupabaseApi: Error response from ${fullApiUrl} (Status: ${response.status}):`,
      errorData,
    );
    throw new Error(
      `API Error (${response.status}) from ${fullApiUrl}: ${errorData.error || "Failed to post batch data"}. Details: ${errorData.details || "N/A"}`,
    );
  }
  // If response is OK, parse and return the JSON data
  try {
    const responseData = await response.json();
    console.log(
      `postBatchToSupabaseApi: Successfully posted batch to ${fullApiUrl}. Received ${responseData?.length || "some"} records.`,
    );
    return responseData;
  } catch (e) {
    console.error(
      `postBatchToSupabaseApi: Error parsing JSON response from ${fullApiUrl}:`,
      e,
    );
    throw new Error(
      `Failed to parse JSON response from ${fullApiUrl} after successful POST.`,
    );
  }
}
