import {
  Button,
  Classes,
  Dialog,
  FileInput,
  Intent,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import React, { useMemo, useState } from "react";
import createBlock from "roamjs-components/writes/createBlock";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import posthog from "posthog-js";
import importDiscourseGraph from "~/utils/importDiscourseGraph";

const ImportDialog = ({ onClose }: { onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File>();
  const title = useMemo(() => value.split(/[/\\]/).slice(-1)[0], [value]);
  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      canEscapeKeyClose
      canOutsideClickClose
      title={`Import Discourse Graph`}
    >
      <div className={Classes.DIALOG_BODY}>
        <FileInput
          text="Choose file..."
          onInputChange={(e) => {
            setValue((e.target as HTMLInputElement).value);
            setFile((e.target as HTMLInputElement).files?.[0]);
          }}
          inputProps={{
            accept: "application/json",
            value,
          }}
        />
        <div>{value.split(/[/\\]/).slice(-1)[0]}</div>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          {loading && <Spinner size={SpinnerSize.SMALL} />}
          <Button
            text={"Import"}
            intent={Intent.PRIMARY}
            disabled={loading}
            onClick={() => {
              setLoading(true);
              posthog.capture("Import Dialog: Import Started", {
                hasFile: !!file,
                title,
              });
              setTimeout(() => {
                const reader = new FileReader();
                reader.onload = (event) => {
                  importDiscourseGraph({
                    ...JSON.parse(event.target?.result as string),
                    title,
                  })
                    .then(() => {
                      const parentUid = window.roamAlphaAPI.util.dateToPageUid(
                        new Date(),
                      );
                      return createBlock({
                        node: { text: `[[${title}]]` },
                        parentUid,
                        order: getChildrenLengthByPageUid(parentUid),
                      });
                    })
                    .then(onClose);
                };
                if (file) reader.readAsText(file);
              }, 1);
            }}
          />
        </div>
      </div>
    </Dialog>
  );
};

type Props = {};

export const render = createOverlayRender<Props>(
  "discourse-import",
  ImportDialog,
);

export default ImportDialog;
