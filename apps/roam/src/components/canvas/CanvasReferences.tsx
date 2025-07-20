import React from "react";
import { PullBlock } from "roamjs-components/types";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";

const CanvasReferencesList = ({
  uid,
  setReferenceCount,
}: {
  uid: string;
  setReferenceCount: (n: number) => void;
}) => {
  const [references, setReferences] = React.useState<
    { uid: string; text: string }[]
  >([]);
  React.useEffect(() => {
    const oldCanvasReferences = window.roamAlphaAPI.data.fast.q(`[:find
      (pull ?c [:block/uid :block/string :node/title])
    :where
      [?c :block/props ?props]
      [(get ?props :roamjs-query-builder) ?rqb]
      [(get ?rqb :tldraw) [[?k ?v]]]
      [(get ?v :props) ?shape-props]
      [(get ?shape-props :uid) ?uid]
      [(= ?uid "${uid}")]
    ]`) as [PullBlock][];
    const newCanvasReferences = window.roamAlphaAPI.data.fast.q(`[:find
        (pull ?c [:block/uid :block/string :node/title])
      :where
        [?c :block/props ?props]
        [(get ?props :roamjs-query-builder) ?rqb]
        [(get ?rqb :tldraw) ?tldraw]
        [(get ?tldraw :store) [[?k ?v]]]
        [(get ?v :props) ?shape-props]
        [(get ?shape-props :uid) ?uid]
        [(= ?uid "${uid}")]
      ]`) as [PullBlock][];
    const newReferences = newCanvasReferences.map((res) => ({
      uid: res[0][":block/uid"] || "",
      text: res[0][":block/string"] || res[0][":node/title"] || "",
    }));
    const oldReferences = oldCanvasReferences.map((res) => ({
      uid: res[0][":block/uid"] || "",
      text: res[0][":block/string"] || res[0][":node/title"] || "",
    }));
    setReferences([...oldReferences, ...newReferences]);
    setReferenceCount(oldReferences.length + newReferences.length);
  }, [setReferences, uid, setReferenceCount]);
  return (
    <div className="m-1">
      {references.map((r) => (
        <div>
          <a>
            <span
              tabIndex={-1}
              className="rm-page__title cursor-pointer"
              onClick={(e) => {
                if (e.shiftKey) {
                  openBlockInSidebar(r.uid);
                } else {
                  window.roamAlphaAPI.ui.mainWindow.openBlock({
                    block: { uid: r.uid },
                  });
                }
              }}
              style={{ textDecoration: "none", fontSize: 16 }}
            >
              {r.text}
            </span>
          </a>
        </div>
      ))}
    </div>
  );
};

const CanvasReferences = ({ uid }: { uid: string }) => {
  const [caretShown, setCaretShown] = React.useState(false);
  const [caretOpen, setCaretOpen] = React.useState(false);
  const [referenceCount, setReferenceCount] = React.useState(0);
  return (
    <>
      <div
        className={"flex-h-box"}
        onMouseEnter={() => setCaretShown(true)}
        onMouseLeave={() => setCaretShown(false)}
        style={{ marginBottom: 4 }}
      >
        <span
          className={`bp3-icon-standard bp3-icon-caret-down rm-caret ${
            caretOpen ? "rm-caret-open" : "rm-caret-closed"
          } ${
            caretShown ? "rm-caret-showing" : "rm-caret-hidden"
          } dont-focus-block`}
          onClick={() => setCaretOpen(!caretOpen)}
        />
        <div style={{ flex: "0 1 2px" }} />
        <div style={{ color: "rgb(206, 217, 224)" }}>
          <strong>{caretOpen && referenceCount} Canvas References</strong>
        </div>
      </div>
      <div style={{ paddingLeft: 16 }}>
        {caretOpen && (
          <CanvasReferencesList
            uid={uid}
            setReferenceCount={setReferenceCount}
          />
        )}
      </div>
    </>
  );
};

export default CanvasReferences;
