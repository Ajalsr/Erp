import DocPrint from '../common/DocPrint';

export default function SalesOrderPrint() {
  return (
    <DocPrint
      apiBase="sales-orders"
      module="sales_orders"
      backPath="/Sales/Salesorders"
      title="Sales Order"
      filePrefix="so"
      numberField="orderNumber"
    />
  );
}
