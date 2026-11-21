import { useEffect } from "react";
import { requestPersistence } from "./data/db";
import { Home } from "./features/home/Home";
import { Projects } from "./features/projects/Projects";
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
      {route.name === "home" ? (
        <Home />
      ) : route.name === "projects" ? (
        <Projects />
      ) : (
        <Workspace key={route.projectId} route={route} />
      )}
      <Toaster />
    </>
  );
}
