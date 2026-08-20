import type { NewsItem } from "~/types/news";
import { formatDisplayDate } from "~/utils/formatDate";

const BUTTONDOWN_EMAILS_URL = "https://api.buttondown.com/v1/emails";

// Buttondown emails have no "category" field to distinguish newsletters from
// other one-off sends, but the API's subject filter does a substring match —
// so this relies on newsletter subjects consistently containing this text
// (e.g. "DG Newsletter: June 2026"). Override via env if the convention changes,
// or set it to an empty string to disable the filter entirely.
const NEWSLETTER_SUBJECT_FILTER =
  process.env.BUTTONDOWN_NEWSLETTER_SUBJECT_FILTER ?? "Newsletter";

type ButtondownEmail = {
  absolute_url: string | null;
  archival_mode: string;
  publish_date: string | null;
  subject: string;
};

type ButtondownEmailsPage = {
  next: string | null;
  results: ButtondownEmail[];
};

const buildEmailsUrl = (): string => {
  const params = new URLSearchParams({ status: "sent" });

  if (NEWSLETTER_SUBJECT_FILTER) {
    params.set("subject", NEWSLETTER_SUBJECT_FILTER);
  }

  return `${BUTTONDOWN_EMAILS_URL}?${params.toString()}`;
};

// archival_mode "enabled" means the email is visible to anyone in the public
// archive (as opposed to subscriber-only, paid-only, or not archived at all).
const isPubliclyArchivedEmail = (
  email: ButtondownEmail,
): email is ButtondownEmail & { absolute_url: string; publish_date: string } =>
  email.archival_mode === "enabled" &&
  Boolean(email.publish_date) &&
  Boolean(email.absolute_url);

const toNewsItem = (
  email: ButtondownEmail & { absolute_url: string; publish_date: string },
): NewsItem => ({
  date: email.publish_date,
  href: email.absolute_url,
  linkText: "View newsletter",
  meta: `${formatDisplayDate(email.publish_date)} | Newsletter`,
  title: email.subject,
});

const fetchAllEmails = async (apiKey: string): Promise<ButtondownEmail[]> => {
  const emails: ButtondownEmail[] = [];
  let nextUrl: string | null = buildEmailsUrl();

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Token ${apiKey}` },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Buttondown API request failed: ${response.status}`);
    }

    const page = (await response.json()) as ButtondownEmailsPage;

    emails.push(...page.results);
    nextUrl = page.next;
  }

  return emails;
};

export const getButtondownNewsletterItems = async (): Promise<NewsItem[]> => {
  const apiKey = process.env.BUTTONDOWN_API_KEY;

  if (!apiKey) {
    return [];
  }

  try {
    const emails = await fetchAllEmails(apiKey);

    return emails.filter(isPubliclyArchivedEmail).map(toNewsItem);
  } catch (error) {
    console.error("Error fetching Buttondown newsletters:", error);
    return [];
  }
};
