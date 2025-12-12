
import { useCallback } from 'react'

const useGenerateCustomerCode = () => {
  const generateCode = useCallback(() => {
    const now = new Date()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const year = now.getFullYear().toString().slice(-2)
    const monthYear = year + month
    
    const storedCounter = localStorage.getItem('counter')
    let counter = 0
    
    if (storedCounter) {
      const parsedCounter = parseInt(storedCounter, 10)
      if (!isNaN(parsedCounter)) {
        counter = parsedCounter
      }
    }
    
    const newCounter = counter + 1
    const paddedCounter = newCounter.toString().padStart(2, '0')
    const customerCode = monthYear + paddedCounter
    
    localStorage.setItem('counter', newCounter.toString())
    
    return customerCode
  }, [])

  return { generateCode }
}

export default useGenerateCustomerCode