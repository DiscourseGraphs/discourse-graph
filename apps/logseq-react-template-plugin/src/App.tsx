import React, { useEffect, useRef, useState } from "react";
import { useAppVisible } from "./utils";

// WARNING: if user clicks fast enough there can be an error, in setNodeTypes useState both nodes can
// have same id. use UUID in that case or ask claude or whatever

function App() {
  const innerRef = useRef<HTMLDivElement>(null);
  const visible = useAppVisible(); // This is a custom React hook that listens to Logseq's UI visibility state!

  interface NodeType{
    id: number,
    name: string,
    description: string
  }

  const [currentTab, setCurrentTab] = useState<string>("Node Types")
  const [nodeTypes, setNodeTypes] = useState<NodeType[]>([{id: Date.now(), name: "", description: ""}])
  const [changesSaved, setChangesSaved] = useState<boolean>(true)

  function addNodeTypes(){
    setNodeTypes(prev => [...prev, {id: Date.now(), name: "", description: ""}])
  }

  async function saveNodeChanges(){
    await logseq.updateSettings({
      nodeTypes: nodeTypes
    });
    setChangesSaved(true)
  }

  useEffect(() => {
    const savedNodeTypes = logseq.settings?.nodeTypes;

    if (Array.isArray(savedNodeTypes) && savedNodeTypes.length > 0) {
      setNodeTypes(savedNodeTypes as NodeType[]);
    }
  }, []);

  if (visible) {
    return (
      <main
        className="backdrop-filter backdrop-blur-md fixed inset-0 flex items-center justify-center"
        onClick={(e) => {
          if (!innerRef.current?.contains(e.target as any)) {
            const savedNodeTypes = logseq.settings?.nodeTypes;

          if (Array.isArray(savedNodeTypes) && savedNodeTypes.length > 0) {
            setNodeTypes(savedNodeTypes as NodeType[]);
          }
            window.logseq.hideMainUI();
          }
        }}
      >
        <div ref={innerRef} className="bg-gray-900 h-4/5 rounded-lg shadow-2xl w-4/5 max-w-4xl flex flex-col">
          Welcome to [[Logseq]] Plugins!

          {/* ---------------------------------------------------------------------------- */}
          <div className="flex gap-4 px-6 pt-4 border-b border-gray-700">
            <button className={`pb-3 px-4 font-medium transition-colors ${
                currentTab === "Node Types"
                  ? "text-purple-500 border-b-2 border-purple-500"
                  : "text-gray-400 hover:text-gray-200"
                }`} onClick={() => setCurrentTab("Node Types")}>Node Type</button>
            <button className={`pb-3 px-4 font-medium transition-colors ${
                currentTab === "relationTypes"
                  ? "text-purple-500 border-b-2 border-purple-500"
                  : "text-gray-400 hover:text-gray-200"
                }`} onClick={() => setCurrentTab("Relation Types")}>Relation Type</button>
            <button className={`pb-3 px-4 font-medium transition-colors ${
                currentTab === "discourseRelations"
                  ? "text-purple-500 border-b-2 border-purple-500"
                  : "text-gray-400 hover:text-gray-200"
                }`} onClick={() => setCurrentTab("Discourse Relations")}>Discourse Relations</button>
          </div> 

          <h1 className="text-xl font-semibold text-white px-6 pb-2 mt-6 border-b border-gray-700">{currentTab}</h1>

          {currentTab === "Node Types" && <div className="pt-4 border-b border-gray-700 overflow-y-auto">
            {nodeTypes.map((node, index) => (
              <div key={node.id} className="flex gap-3 items-center px-6 pb-2 mb-2">
                <input placeholder="Name" type="text" className="flex-1 bg-gray-800 text-white px-4 py-2 rounded border border-gray-700 focus:border-purple-500 focus:outline-none" 
                value={node.name} onChange={(e) => {
                
                  setChangesSaved(false)
                  setNodeTypes(prev => // we need prev to access previous state
                    prev.map((item, i) =>
                      item.id === node.id
                        ? { ...item, name: e.target.value }
                        : item
                    )
                  );
                }}/>

                <input placeholder="Format" type="text" className="flex-1 bg-gray-800 text-white px-4 py-2 rounded border border-gray-700 focus:border-purple-500 focus:outline-none"
                 value={node.description} onChange={(e) => {

                  setNodeTypes(prev =>
                    prev.map((item, i) =>
                      item.id === node.id
                        ? { ...item, description: e.target.value }
                        : item
                    )
                  );
                }}/>

                <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-medium transition-colors"
                 onClick={() => {if(nodeTypes.length > 1){ setNodeTypes(prev => prev.filter(item => item.id !== node.id) )} 
                 else if (nodeTypes.length === 1 && nodeTypes[0].name != ""){setNodeTypes ([{id: Date.now(), name: "", description: ""}])}
                  setChangesSaved(false)}}>
                  Delete
                </button>

              </div>
            ))}

            
          </div>}

          <div className="flex gap-3 my-6 mx-6 shrink-0">
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded font-medium transition-colors"
               onClick={addNodeTypes}>Add Node Type</button>
              <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded font-medium transition-colors"
               onClick={saveNodeChanges}>Save Changes</button>
          </div>

          {/* {!changesSaved && <p className="text-white px-6 py-2">You have unsaved changes</p>} */}

          



          {/* ---------------------------------------------------------------------------- */}

        </div>
      </main>
    );
  }
  return null;
}

export default App;
