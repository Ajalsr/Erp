import { useState } from "react";
import { FaThList, FaThLarge, FaPlus, FaEllipsisV, FaFilter } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function Item() {
  const navigate = useNavigate();
  const [items] = useState([
    {
      id: 1,
      name: "Storage Cabinet",
      sku: "Item 37 sku",
      type: "Service",
      description: "A versatile storage cabinet with adjustable shelves.",
      rate: "AED4610.00",
      image: "https://via.placeholder.com/40",
    },
    {
      id: 2,
      name: "Area Rug",
      sku: "Item 38 sku",
      type: "Service",
      description: "A soft, high-quality area rug to add warmth to any room.",
      rate: "AED2990.00",
      image: "https://via.placeholder.com/40",
    },
    {
      id: 3,
      name: "Dining Table and Chairs Set",
      sku: "Item 39 sku",
      type: "Service",
      description: "A stylish dining set with a table and four chairs.",
      rate: "AED441.00",
      image: "https://via.placeholder.com/40",
    },
    {
      id: 4,
      name: "Composite Item 4",
      sku: "89612",
      type: "Goods",
      description:
        "Illo accusantium aliquid. Asperiores libero nemo aspernatur ex.",
      rate: "AED590.00",
      image: "https://via.placeholder.com/40",
    },
    {
      id: 5,
      name: "Office Chair",
      sku: "Item 40 sku",
      type: "Goods",
      description: "Ergonomic chair with adjustable height and backrest.",
      rate: "AED950.00",
      image: "https://via.placeholder.com/40",
    },
  ]);

  // ✅ Pagination Logic
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 2;

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = items.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  return (
    <div className="bg-white min-h-screen p-6 text-gray-800">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">All Items</h2>
          <button className="text-gray-500 hover:text-gray-700">
            <FaFilter />
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button className="p-2 border rounded-md hover:bg-gray-100">
            <FaThList className="text-gray-600" />
          </button>
          <button className="p-2 border rounded-md hover:bg-gray-100">
            <FaThLarge className="text-gray-600" />
          </button>
          <button className="bg-blue-600 text-white px-3 py-2 rounded-md flex items-center space-x-2 hover:bg-blue-700" onClick={ () => navigate("/Items/Items/New")} >
            <FaPlus />
            <span>New</span>
          </button>
          <button className="p-2 border rounded-md hover:bg-gray-100">
            <FaEllipsisV className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left w-4"></th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium text-right">Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentItems.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                </td>
                <td className="px-4 py-3 flex items-center space-x-3">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-8 h-8 rounded border border-gray-200"
                  />
                  <a
                    href="#"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {item.name}
                  </a>
                </td>
                <td className="px-4 py-3 text-gray-700">{item.sku}</td>
                <td className="px-4 py-3 text-gray-700">{item.type}</td>
                <td className="px-4 py-3 text-gray-600 truncate max-w-xs">
                  {item.description}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">
                  {item.rate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
        <div>
          Showing {startIndex + 1} -{" "}
          {Math.min(startIndex + itemsPerPage, items.length)} of {items.length}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded-md hover:bg-gray-100 disabled:opacity-50"
          >
            Prev
          </button>

          {[...Array(totalPages)].map((_, index) => (
            <button
              key={index}
              onClick={() => handlePageChange(index + 1)}
              className={`px-3 py-1 border rounded-md ${
                currentPage === index + 1
                  ? "bg-blue-500 text-white"
                  : "hover:bg-gray-100"
              }`}
            >
              {index + 1}
            </button>
          ))}

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded-md hover:bg-gray-100 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
