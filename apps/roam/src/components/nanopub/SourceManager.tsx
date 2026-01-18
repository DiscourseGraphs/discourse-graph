import React, { useCallback, useRef, useEffect } from "react";
import { FormGroup, InputGroup } from "@blueprintjs/core";
import { NanopubPage } from "./Nanopub";

type SourceManagerProps = {
  pageUid: string;
  pageProps: Record<string, unknown>;
  source: string;
  setSource: React.Dispatch<React.SetStateAction<string>>;
  requireSource?: boolean;
};

const SourceManager = ({
  pageUid,
  pageProps: props,
  source,
  setSource,
  requireSource,
}: SourceManagerProps) => {
  const debounceRef = useRef(0);
  const nanopubProps = props["nanopub"] as NanopubPage;

  const updateSourceProps = useCallback(
    (newSource: string) => {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        window.roamAlphaAPI.updateBlock({
          block: {
            uid: pageUid,
            props: {
              ...props,
              nanopub: { ...nanopubProps, source: newSource },
            },
          },
        });
      }, 1000);
    },
    [pageUid, props, nanopubProps]
  );

  useEffect(() => {
    updateSourceProps(source);
  }, [source, updateSourceProps]);

  const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSource(e.target.value);
  };

  return (
    <div className="space-y-4">
      <FormGroup
        helperText={`Enter the URL of the source paper. ${requireSource ? "" : "(optional)"}`}
      >
        <InputGroup
          value={source}
          onChange={handleSourceChange}
          placeholder="https://doi.org/..."
          className="w-full"
        />
      </FormGroup>
      {requireSource && !source ? (
        <span className="text-warning">(required)</span>
      ) : null}
    </div>
  );
};

export default SourceManager;
