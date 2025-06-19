import React from "react";
import SuggestionsBody from "./SuggestionsBody";
import { OnloadArgs } from "roamjs-components/types/native";
import ReactDOM from "react-dom";
import { Spinner } from "@blueprintjs/core";
import { useDiscourseData } from "~/utils/useDiscourseData";

const InlineSuggestions = ({
  tag,
  blockUid,
}: {
  tag: string;
  blockUid: string;
}) => {
  const { loading, results } = useDiscourseData(tag);

  return (
    <div className="roamjs-discourse-inline-suggestions rounded-md bg-blue-50 p-2">
      {loading ? (
        <Spinner size={Spinner.SIZE_SMALL} />
      ) : (
        <SuggestionsBody
          tag={tag}
          blockUid={blockUid}
          existingResults={results}
        />
      )}
    </div>
  );
};

export const render = ({
  parent,
  tag,
  blockUid,
}: {
  parent: HTMLElement;
  tag: string;
  blockUid: string;
  onloadArgs?: OnloadArgs; // unused presently
}) => {
  ReactDOM.render(<InlineSuggestions tag={tag} blockUid={blockUid} />, parent);
};

export default InlineSuggestions;
