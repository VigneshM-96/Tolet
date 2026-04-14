import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import PropertyListing from "./pages/PropertyListing";
import AddProperty from "./pages/AddProperty";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/list-property" element={<AddProperty />} />
      <Route path="/search" element={<PropertyListing />} />
    </Routes>
  );
}

export default App;