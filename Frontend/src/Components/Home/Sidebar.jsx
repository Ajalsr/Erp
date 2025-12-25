import { useState } from "react";
import { IoHome, IoChevronDown, IoChevronForward } from "react-icons/io5";
import { FaShoppingBag } from "react-icons/fa";
import { FaCartShopping } from "react-icons/fa6";
import { MdInventory } from "react-icons/md";
import { GiShoppingBag } from "react-icons/gi";
import { useNavigate } from "react-router-dom";

const Sidebar = ({ isCollapsed }) => {
  const [openMenu, setOpenMenu] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const navigate = useNavigate();

  const menuItems = [
    {
      icon: <IoHome />,
      label: "Home",
      route: "/Home",
    },
    {
      icon: <FaShoppingBag />,
      label: "Items",
      subItems: [
        { name: "Items", route: "/Items/Items" },
        { name: "Composite Items", route: "/home/composite-items" },
        { name: "Item Groups", route: "/home/item-groups" },
        { name: "Price Lists", route: "/home/price-lists" },
      ],
    },
    {
      icon: <MdInventory />,
      label: "Inventory",
      subItems: [
        { name: "Item 1", route: "/home/inventory/item1" },
        { name: "Item 2", route: "/home/inventory/item2" },
      ],
    },
    {
      icon: <FaCartShopping />,
      label: "Sales",
      subItems: [
        { name: "Customers", route: "/Sales/Customers" },
        { name: "Retainer Invoices", route: "/Sales/Customers" },
        { name: "Sales Orders", route: "/Sales/Salesorders" },
        { name: "Outbound", route: "/Sales/Outbound" },
        { name: "Invoices", route: "/Sales/Customers" },
        { name: "Delivery Challans", route: "/Sales/Customers" },
        { name: "Payments Received", route: "/Sales/Customers" },
        { name: "Sales Returns", route: "/Sales/Customers" },
        { name: "Credit Notes", route: "/Sales/Customers" },
      ],
    },
    {
      icon: <GiShoppingBag />,
      label: "Purchases",
      subItems: [
        { name: "Vendors", route: "/Sales/Vendors" },
        { name: "Purchase Orders", route: "/Purchase/Purchaseorders" },
        { name: "Bills", route: "/Sales/Customers" },
        { name: "Purchase Returns", route: "/Sales/Customers" },
        { name: "Payments Made", route: "/Sales/Customers" },
        { name: "Vendor Credits", route: "/Sales/Customers" },
      ],
    },
  ];

  const handleToggle = (item) => {
    if (item.subItems) {
      setOpenMenu((prev) => (prev === item.label ? null : item.label));
    } else {
      setActiveItem(item.label);
      navigate(item.route);
    }
  };

  const handleSubItemClick = (subItem) => {
    setActiveItem(subItem.name);
    navigate(subItem.route);
  };

  return (
    <div
      className={`bg-gray-800 text-white flex flex-col fixed md:relative z-10 transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      } h-screen`} // Changed h-full to h-screen
    >
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        {!isCollapsed && <h2 className="text-xl font-bold">ERP</h2>}
      </div>

      <nav className="flex-1 p-4 overflow-y-auto"> {/* Added overflow-y-auto */}
        <ul className="space-y-2">
          {menuItems.map((item, index) => {
            const isOpen = openMenu === item.label;
            const isActive = activeItem === item.label;
            const hasSubItems = !!item.subItems;

            return (
              <li key={index}>
                <button
                  onClick={() => handleToggle(item)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors duration-200 ${
                    isActive
                      ? "bg-blue-500 text-white"
                      : "hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  <div className="flex items-center">
                    <span className="flex items-center justify-center w-6 mr-3">
                      {item.icon}
                    </span>
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>

                  {/* Chevron icons for expandable items */}
                  {!isCollapsed && hasSubItems && (
                    <span className="ml-auto">
                      {isOpen ? <IoChevronDown /> : <IoChevronForward />}
                    </span>
                  )}
                </button>

                {!isCollapsed && hasSubItems && (
                  <div
                    className={`ml-8 overflow-hidden transition-all duration-500 ease-in-out ${
                      isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <ul className="mt-2 space-y-1 text-sm text-gray-300">
                      {item.subItems.map((subItem, subIndex) => (
                        <li
                          key={subIndex}
                          onClick={() => handleSubItemClick(subItem)}
                          className={`cursor-pointer ml-9 p-2 rounded-lg transition-colors duration-200 ${
                            activeItem === subItem.name
                              ? "bg-blue-500 text-white"
                              : "hover:bg-gray-700 hover:text-white"
                          }`}
                        >
                          {subItem.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;