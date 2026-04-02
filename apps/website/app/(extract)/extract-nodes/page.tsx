import { MainContent } from "./components/MainContent";
import { Sidebar } from "./components/Sidebar";

const ExtractNodesPage = (): React.ReactElement => {
  return (
    <div className="flex h-full w-full flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-5 lg:p-5">
      <Sidebar />
      <MainContent />
    </div>
  );
};

export default ExtractNodesPage;
