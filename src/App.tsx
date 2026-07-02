import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/home";
import Admin from "./pages/admin";
import TourViewer from "./pages/tour-viewer";
import { ThemeProvider } from "@/components/theme-provider";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/:id" element={<Admin />} />
          <Route path="/tour/:id" element={<TourViewer />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
