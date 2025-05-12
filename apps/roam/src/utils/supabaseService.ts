export const fetchSupabaseEntity = async (entityType: string, payload: any) => {
  console.log(
    `fetchSupabaseEntity: Syncing ${entityType} with payload:`,
    payload,
  );

  const baseInsertApiUrl =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000/api/supabase/insert"
      : "https://discoursegraphs.com/api/supabase/insert";

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
