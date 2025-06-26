import React from "react";
import SuggestionsBody from "./SuggestionsBody";
import { OnloadArgs } from "roamjs-components/types/native";
import ReactDOM from "react-dom";
import { Spinner } from "@blueprintjs/core";
import { useDiscourseData } from "~/utils/useDiscourseData";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";

const InlineSuggestions = ({
  tag,
  blockUid,
}: {
  tag: string;
  blockUid: string;
}) => {
  const { loading, results } = useDiscourseData(tag);

  return (
    <div className="roamjs-discourse-inline-suggestions rounded-md border border-blue-200 bg-white p-2">
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
  onloadArgs,
}: {
  parent: HTMLElement;
  tag: string;
  blockUid: string;
  onloadArgs: OnloadArgs;
}) => {
  ReactDOM.render(
    <ExtensionApiContextProvider {...onloadArgs}>
      <InlineSuggestions tag={tag} blockUid={blockUid} />
    </ExtensionApiContextProvider>,
    parent,
  );
};

export default InlineSuggestions;
