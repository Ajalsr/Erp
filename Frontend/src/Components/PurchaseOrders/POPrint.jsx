import DocPrint from '../common/DocPrint';

export default function POPrint() {
  return (
    <DocPrint
      apiBase="purchase-orders"
      module="purchase_orders"
      backPath="/Purchase/Purchaseorders"
      title="Purchase Order"
      filePrefix="po"
      numberField="orderNumber"
    />
  );
}
