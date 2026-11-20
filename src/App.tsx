import { useEffect } from "react";
import { requestPersistence } from "./data/db";
import { Home } from "./features/home/Home";
import { Workspace } from "./features/workspace/Workspace";
import { useRoute } from "./state/router";
import { Toaster } from "./ui/toast";

export function App() {
  const route = useRoute();
  useEffect(() => {
    void requestPersistence();
  }, []);
  return (
    <>
      {route.name === "home" ? <Home /> : <Workspace key={route.projectId} route={route} />}
      <Toaster />
    </>
  );
}
