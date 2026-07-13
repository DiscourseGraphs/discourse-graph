export const DISCOURSE_CONTEXT_MUTATION_REFRESH_EVENT =
  "roamjs:discourse-context:mutation-refresh";

export type DiscourseContextMutationRefreshDetail = {
  uids: string[];
};

export const refreshDiscourseContextsForMutatedUids = ({
  uids,
}: DiscourseContextMutationRefreshDetail): void => {
  const uniqueUids = Array.from(
    new Set(uids.map((uid) => uid?.trim()).filter(Boolean)),
  );
  if (!uniqueUids.length) return;
  document.body.dispatchEvent(
    new CustomEvent<DiscourseContextMutationRefreshDetail>(
      DISCOURSE_CONTEXT_MUTATION_REFRESH_EVENT,
      {
        detail: {
          uids: uniqueUids,
        },
      },
    ),
  );
};
