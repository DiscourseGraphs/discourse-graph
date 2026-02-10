import "@logseq/libs";

import React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { logseq as PL } from "../package.json";

// @ts-expect-error
const css = (t, ...args) => String.raw(t, ...args);

const pluginId = PL.id;

function main() {
  console.info(`#${pluginId}: MAIN`);
  const root = ReactDOM.createRoot(document.getElementById("app")!);

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  logseq.useSettingsSchema([ // This tells Logseq: I want persistent storage called nodeTypes
    {
      key: "nodeTypes",
      type: "object", // bcos I used type: object logseq cant create a UI input for it, 
      // so it will show a link Edit settings.json, 
      // if it were input: string then we would have an input UI in plugin settings  
      default: [],
      title: "Node Types",
      description: "Custom node types"
    }
  ])

  function createModel() {
    return {
      show() {
        logseq.showMainUI();
      },
    };
  }

  logseq.provideModel(createModel());
  logseq.setMainUIInlineStyle({
    zIndex: 11,
  });

  const openIconName = "template-plugin-open";

  logseq.provideStyle(css`
    .${openIconName} {
      opacity: 0.55;
      font-size: 20px;
      margin-top: 4px;
    }

    .${openIconName}:hover {
      opacity: 0.9;
    }
  `);

  logseq.App.registerUIItem("toolbar", {
    key: openIconName,
    template: `
    <a data-on-click="show">
        <div class="${openIconName}">⚙️</div>
    </a>    
`,
  });
}

logseq.ready(main).catch(console.error);
