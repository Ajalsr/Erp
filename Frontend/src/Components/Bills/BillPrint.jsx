import DocPrint from '../common/DocPrint';

export default function BillPrint() {
  return (
    <DocPrint
      apiBase="bills"
      module="bills"
      backPath="/Purchase/Bills"
      title="Bill"
      filePrefix="bill"
      numberField="billNumber"
    />
  );
}
