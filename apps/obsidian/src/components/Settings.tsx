import { useApp } from "~/components/AppContext";

const Settings = () => {
  const app = useApp();
  if (!app) {
    return <div>An error occured</div>;
  }

  return <h4>Settings for {app.vault.getName()}</h4>;
};

export default Settings;
