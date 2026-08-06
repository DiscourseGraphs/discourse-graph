import { useEffect } from "react";

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

// Both the always-mounted overlay button state and the (sometimes unmounted)
// context body need to react to the same event, so the subscription lives here.
export const useDiscourseContextMutationRefresh = ({
  uid,
  onMutationRefresh,
}: {
  uid: string;
  onMutationRefresh: () => void;
}): void => {
  useEffect(() => {
    const handleMutationRefresh = (event: Event) => {
      const { detail } =
        event as CustomEvent<DiscourseContextMutationRefreshDetail>;
      if (!detail?.uids.includes(uid)) return;
      onMutationRefresh();
    };

    document.body.addEventListener(
      DISCOURSE_CONTEXT_MUTATION_REFRESH_EVENT,
      handleMutationRefresh,
    );
    return () => {
      document.body.removeEventListener(
        DISCOURSE_CONTEXT_MUTATION_REFRESH_EVENT,
        handleMutationRefresh,
      );
    };
  }, [uid, onMutationRefresh]);
};
