import { useEffect, useState } from "react";
import { FaThList, FaThLarge, FaPlus, FaEllipsisV, FaFilter } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useGetItem from '../../helper/useGetItem';


export default function Item() {
  const { handleGetItem, data, loading, error } = useGetItem();
  const navigate = useNavigate();
  
  // Fallback data in case API fails or returns empty
  const [localItems] = useState([
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
    }
  ]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 200;

  // ✅ Use API data if available and is array, otherwise use fallback
  const displayItems = Array.isArray(data) && data.length > 0 ? data : localItems;
  
  const totalPages = Math.ceil(displayItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = displayItems.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  useEffect(() => {
    handleGetItem();
  }, [handleGetItem]);

  // Debug
  console.log("API Data:", data);
  console.log("Display Items:", displayItems);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

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
          <button 
            className="bg-blue-600 text-white px-3 py-2 rounded-md flex items-center space-x-2 hover:bg-blue-700 cursor-pointer" 
            onClick={() => navigate("/Items/Items/New")}
          >
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
        <th className="px-4 py-3 text-left w-8">
          <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
        </th>
        <th className="px-4 py-3 text-left font-medium w-1/4">Name</th>
        <th className="px-4 py-3 text-left font-medium w-1/6">Item Code</th>
        <th className="px-4 py-3 text-left font-medium w-1/6">Brand</th>
        <th className="px-4 py-3 text-left font-medium w-1/6">Quantity</th>
        <th className="px-4 py-3 text-left font-medium w-1/3">Description</th>
        <th className="px-4 py-3 text-right font-medium w-1/6">Selling Price</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {currentItems.map((item, index) => (
        <tr key={item._id || item.id || index} className="hover:bg-gray-50">
          <td className="px-4 py-3">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center space-x-3">
              <img
                src={item.image || "https://via.placeholder.com/40"}
                alt={item.name}
                className="w-8 h-8 rounded border border-gray-200"
              />
              <span className="text-blue-600 hover:underline font-medium cursor-pointer">
                {item.name}
              </span>
            </div>
          </td>
          <td className="px-4 py-3 text-gray-700">{item.item_code || "N/A"}</td>
          <td className="px-4 py-3 text-gray-700">{item.brand || "N/A"}</td>
          <td className="px-4 py-3 text-gray-600 ">
            <div className="truncate" title={item.quantity}>
              {item.quantity || "0" }
            </div>
          </td>
          <td className="px-4 py-3 text-gray-600 max-w-xs">
            <div className="truncate" title={item.sales_description}>
              {item.sales_description || "No description"}
            </div>
          </td>
          <td className="px-4 py-3 text-right font-medium text-gray-800">
            {item.selling_price ? `AED ${item.selling_price}` : "N/A"}
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
          {Math.min(startIndex + itemsPerPage, displayItems.length)} of {displayItems.length}
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