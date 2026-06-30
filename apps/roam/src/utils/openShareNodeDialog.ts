import { render as exportRender } from "~/components/Export";

export const openShareNodeDialog = ({
  uid,
  title,
  nodeType,
}: {
  uid: string;
  title: string;
  nodeType: string;
}): void => {
  exportRender({
    results: [{ uid, text: title, type: nodeType }],
    isExportDiscourseGraph: true,
    initialPanel: "publish",
  });
};
