import React, { useMemo, useRef, useEffect } from "react";
import {
  VerticalTimeline,
  VerticalTimelineElement,
} from "react-vertical-timeline-component";
import "react-vertical-timeline-component/style.min.css";
import { Icon } from "@blueprintjs/core";
import PageLink from "roamjs-components/components/PageLink";
import { Result } from "roamjs-components/types/query-builder";

type TimelineProps = { timelineElements: Result[] };

// const LAYOUTS = {
//   LEFT: "1-column-left",
//   RIGHT: "1-column-right",
//   ALT: "2-columns",
// };

// const getLayout = (blockUid: string) => {
//   const tree = getFullTreeByParentUid(blockUid);
//   const layoutNode = tree.children.find((t) => /layout/i.test(t.text));
//   if (layoutNode && layoutNode.children.length) {
//     return (
//       LAYOUTS[
//         layoutNode.children[0].text.toUpperCase() as keyof typeof LAYOUTS
//       ] || "2-columns"
//     );
//   }
//   return "2-columns";
// };

// const getColors = (blockUid: string) => {
//   const tree = getFullTreeByParentUid(blockUid);
//   const colorNode = tree.children.find((t) => /colors/i.test(t.text));
//   if (colorNode && colorNode.children.length) {
//     return colorNode.children.map((c) => c.text);
//   }
//   return ["#2196f3"];
// };

const TimelineElement = ({
  color,
  t,
}: {
  color: string;
  t: Result & { date: Date };
}) => {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current) return;
    window.roamAlphaAPI.ui.components.renderBlock({
      uid: t.uid,
      el: containerRef.current,
    });
  }, [t.uid, containerRef]);
  return (
    <VerticalTimelineElement
      contentStyle={{
        backgroundColor: color,
        color: "#fff",
      }}
      contentArrowStyle={{
        borderRight: `7px solid ${color}`,
      }}
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore could technically take react node
      date={
        <PageLink uid={window.roamAlphaAPI.util.dateToPageUid(t.date)}>
          {window.roamAlphaAPI.util.dateToPageTitle(t.date)}
        </PageLink>
      }
      dateClassName={"roamjs-timeline-date"}
      iconStyle={{
        backgroundColor: color,
        color: "#fff",
      }}
      icon={<Icon icon="calendar" style={{ height: "100%", width: "100%" }} />}
    >
      <h4 className="vertical-timeline-element-title">
        <PageLink uid={t.uid}>{t.text}</PageLink>
      </h4>
      <p className="vertical-timeline-element-body" ref={containerRef} />
    </VerticalTimelineElement>
  );
};

const colors = ["#7F1D1D", "#14532d", "#1e3a8a"];

const Timeline: React.FunctionComponent<TimelineProps> = ({
  timelineElements,
}) => {
  const datedTimelineElements = useMemo(
    () =>
      timelineElements
        .map((t) =>
          Object.fromEntries(
            Object.entries(t).map(([k, v]) => [
              k.toLowerCase(),
              /date/i.test(k)
                ? typeof v === "string"
                  ? window.roamAlphaAPI.util.pageTitleToDate(v)
                  : new Date(v)
                : v,
            ]),
          ),
        )
        .filter(
          (t): t is Result & { date: Date } => !!t.date && !!t.date.valueOf(),
        ),
    [timelineElements],
  );
  return datedTimelineElements.length < timelineElements.length ? (
    <p className="m-0 p-2 pr-16">
      Some of the results in this query are missing a <code>Date</code> column.
      To use the Timeline layout, make sure that you add a selections labelled{" "}
      <code>Date</code> and that all results return a valid date value for that
      selection.
    </p>
  ) : (
    <>
      <VerticalTimeline layout={"2-columns"} className={"mt-1"}>
        <style>{`.vertical-timeline-element-body > .rm-block > .rm-block-main {
  display: none;
}

.vertical-timeline-element-body > .rm-block > .rm-block-children .rm-multibar {
  display: none;
}

.vertical-timeline-element-body > .rm-block > .rm-block-children {
  margin-left: -32px;
}`}</style>
        {datedTimelineElements.map((t, i) => (
          <TimelineElement
            color={colors[i % colors.length]}
            t={t}
            key={`${t.uid}-${t.date}`}
          />
        ))}
      </VerticalTimeline>
    </>
  );
};

export default Timeline;
