import React from "react";

export const QueryBuilderLoadedToast = () => (
  <div className="p-4">
    <h3 className="text-center text-xl font-bold">
      Discourse Graph Not Loaded
    </h3>
    <p>
      The <strong>Query Builder</strong> extension is already loaded elsewhere.
    </p>
    <p>Having both loaded at the same time may cause issues.</p>
    <p className="mt-4 w-fit rounded-md bg-white p-3 text-center font-medium text-gray-800">
      Please disable Query Builder
      <br />
      then reload your graph.
    </p>
  </div>
);
