import { useEffect, useState } from "react";


const Home = () => {

  const[data, setData]= useState();
  useEffect(() => {
    const storedData = localStorage.getItem('userData'); 
  if (storedData) {
    const parsedData = JSON.parse(storedData); 
    setData(parsedData); 
    console.log(parsedData, "this is data"); 
  }
  },[])
  return (
    <div className="min-h-screen bg-gray-50 rounded-lg">
      
      <div className="bg-white shadow-sm p-5 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Hello, {data?.userId}</h2>
          <p className="text-gray-500 text-sm">{data?.companyName}</p>
        </div>

        <div className="text-right">
          <p className="text-sm text-blue-600 font-medium">VAT Resources</p>
          <p className="text-xs font-semibold">Zoho Inventory Helpline: 80004440824</p>
          <p className="text-xs text-gray-500">Sun–Fri · 9:00 AM – 6:00 PM</p>
        </div>
      </div>

      
      <div className="bg-white border-b px-6 py-3">
        <ul className="flex space-x-8 text-gray-600 font-medium">
          <li className="text-blue-600 border-b-2 border-blue-600 pb-1 cursor-pointer">Dashboard</li>
          <li className="cursor-pointer hover:text-blue-600">Getting Started</li>
          <li className="cursor-pointer hover:text-blue-600">Announcements</li>
          <li className="cursor-pointer hover:text-blue-600">Recent Updates</li>
        </ul>
      </div>

      
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Sales Activity</h3>

          <div className="grid grid-cols-4 gap-5">
            <CardNumber title="TO BE PACKED" number="51" unit="Qty" color="text-blue-500" />
            <CardNumber title="TO BE SHIPPED" number="40" unit="Pkgs" color="text-red-500" />
            <CardNumber title="TO BE DELIVERED" number="52" unit="Pkgs" color="text-green-500" />
            <CardNumber title="TO BE INVOICED" number="97" unit="Qty" color="text-yellow-500" />
          </div>
        </div>

        
        <div className="bg-white shadow rounded-lg p-6 w-1/2">
          <h3 className="text-lg font-semibold mb-4">Inventory Summary</h3>

          <div className="space-y-3">
            <div className="flex justify-between text-gray-700">
              <span>QUANTITY IN HAND</span>
              <span className="font-bold text-xl">12746</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>QUANTITY TO BE RECEIVED</span>
              <span className="font-bold text-xl">62</span>
            </div>
          </div>
        </div>

       
        <div className="grid grid-cols-3 gap-6">

         
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Product Details</h3>

            <div className="space-y-3">
              <p className="text-red-500 font-semibold">Low Stock Items: 22</p>
              <p className="text-gray-700">All Item Groups: 34</p>
              <p className="text-gray-700">All Items: 129</p>

             
              <div className="flex items-center justify-center mt-4">
                <div className="w-28 h-28 rounded-full border-8 border-green-500 border-t-gray-200">
                </div>
              </div>

              <p className="text-center font-semibold text-gray-700 mt-2">Active Items (78%)</p>
            </div>
          </div>

        
          <div className="bg-white shadow rounded-lg p-6 col-span-2">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Top Selling Items</h3>
              <p className="text-sm text-gray-600 cursor-pointer">This Month ▼</p>
            </div>

            <div className="flex space-x-8 mt-6">

              <ItemCard title="Dining Table and Chairs Set" qty="210" />
              <ItemCard title="Coffee Table" qty="299" />
              <ItemCard title="Coffee Table" qty="92" />

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};


const CardNumber = ({ title, number, unit, color }) => (
  <div className="text-center">
    <p className={`${color} text-3xl font-bold`}>{number}</p>
    <p className="text-sm text-gray-500">{unit}</p>
    <p className="mt-1 text-gray-600 text-sm">{title}</p>
  </div>
);

const ItemCard = ({ title, qty }) => (
  <div className="w-40 text-center">
    <div className="w-full h-24 bg-gray-200 rounded-lg"></div>
    <p className="mt-2 font-medium">{title}</p>
    <p className="text-xl font-bold mt-1">{qty}Mtr</p>
  </div>
);

export default Home;
