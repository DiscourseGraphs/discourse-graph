import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import type { PullBlock } from "roamjs-components/types/native";

type Props = { title: string };

const Content = ({ title, uid }: { title: string; uid: string }) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sectionRef.current;
    if (el)
      window.roamAlphaAPI.ui.components.renderBlock({
        el,
        uid,
      });
  }, [uid]);
  return (
    <div>
      <h6>{title}</h6>
      <div ref={sectionRef}></div>
    </div>
  );
};

const ContextContent = ({ title }: Props) => {
  const queryResults = useMemo(
    () =>
      (
        window.roamAlphaAPI.data.fast.q(
          `[:find (pull ?pr [:node/title]) (pull ?r [:block/uid :block/children :create/time]) :where [?p :node/title "${title}"] [?r :block/refs ?p] [?r :block/page ?pr]]`,
        ) as [PullBlock, PullBlock][]
      )
        .filter(
          ([, { [":block/children"]: children = [] }]) => !!children.length,
        )
        .sort(
          ([, { [":create/time"]: a = 0 }], [, { [":create/time"]: b = 0 }]) =>
            a - b,
        ),
    [title],
  );
  return (
    <>
      {queryResults.map(
        ([{ [":node/title"]: title = "" }, { [":block/uid"]: uid = "" }]) => (
          <Content title={title} uid={uid} />
        ),
      )}
    </>
  );
};

const ReferenceContext = ({ title }: Props) => {
  const [caretShown, setCaretShown] = useState(false);
  const [caretOpen, setCaretOpen] = useState(false);
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
          <strong>Reference Context</strong>
        </div>
      </div>
      {caretOpen && <ContextContent title={title} />}
    </>
  );
};

export const render = (props: Props) => {
  const container = document.createElement("div");
  ReactDOM.render(<ReferenceContext {...props} />, container);
  return container;
};

export default ReferenceContext;
