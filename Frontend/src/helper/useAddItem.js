import api from './axiosInstance'

const useAddItem = () => {
  const handleAdditem = async (inputs) => {
    const response = await api.post('/api/stocks/additem', inputs)
    return response.data
  }
  return { handleAdditem }
}

export default useAddItem
