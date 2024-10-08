import React from "react";
import { Chart, AxisOptions, AxisOptionsBase } from "react-charts";
import { Result } from "roamjs-components/types/query-builder";
import { Column } from "~/utils/types";

type ChartData = [Result[string], Result[string]];

const Charts = ({
  data,
  type,
  columns,
}: {
  type: AxisOptionsBase["elementType"];
  data: Result[];
  columns: Column[];
}): JSX.Element => {
  const chartData = React.useMemo(
    () =>
      columns.slice(1).map((col) => {
        return {
          label: col.key,
          data: data.map((d) => [d[columns[0].key], d[col.key]] as ChartData),
        };
      }),
    [data, columns]
  );
  const primaryAxis = React.useMemo<AxisOptions<ChartData>>(
    () => ({
      primary: true,
      type: "timeLocal",
      position: "bottom" as const,
      getValue: ([d]) =>
        d instanceof Date
          ? d
          : typeof d === "string"
          ? window.roamAlphaAPI.util.pageTitleToDate(d)
          : new Date(d),
    }),
    []
  );
  const secondaryAxes = React.useMemo<AxisOptions<ChartData>[]>(
    () =>
      columns.slice(1).map(() => ({
        type: "linear",
        position: "left" as const,
        getValue: (d) => Number(d[1]) || 0,
        elementType: type,
      })),
    [type]
  );

  return Object.keys(primaryAxis).length !== 0 && !secondaryAxes.length ? (
    <p className="p-2 pr-16 m-0">
      You need to have at least <strong>two selections</strong> for this layout
      to work, where the first is a selection that returns{" "}
      <strong>date values</strong> and all subsequent selections return{" "}
      <strong>numeric values</strong>.
    </p>
  ) : (
    <div style={{ height: 300 }}>
      <Chart options={{ data: chartData, primaryAxis, secondaryAxes }} />
    </div>
  );
};

export default Charts;
