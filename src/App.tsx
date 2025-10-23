import { RouterProvider } from "react-router";
import { router } from "./Pages/route";
import "./index.css";

export default function App() {
  return (
    <div className="App">
      <RouterProvider {...{ router }} />
    </div>
  );
}
