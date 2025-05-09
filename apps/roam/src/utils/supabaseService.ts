export async function fetchSupabaseEntity(
  apiUrl: string,
  payload: any,
  entityName: string,
) {
  console.log(
    `fetchSupabaseEntity: Syncing ${entityName} with payload:`,
    payload,
  );

  const baseApiUrl =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://discoursegraphs.com";

  const fullApiUrl = apiUrl.startsWith("/") ? `${baseApiUrl}${apiUrl}` : apiUrl;
  console.log(`fetchSupabaseEntity: Calling ${fullApiUrl}`);

  const response = await fetch(fullApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `fetchSupabaseEntity: Failed to get/create ${entityName} at ${fullApiUrl}. Status: ${response.status}. Error:`,
      errorText,
      "Payload:",
      payload,
    );
    throw new Error(
      `Failed to sync ${entityName}: ${response.status} ${errorText}`,
    );
  }
  const responseData = await response.json();
  console.log(
    `fetchSupabaseEntity: Successfully synced ${entityName}. Response:`,
    responseData,
  );
  return responseData;
}
