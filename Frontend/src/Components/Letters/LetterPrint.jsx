import DocPrint from '../common/DocPrint';

export default function LetterPrint() {
  return (
    <DocPrint
      apiBase="letters"
      module="letters"
      backPath="/Letters"
      title="Letter"
      filePrefix="letter"
      numberField="letterNumber"
    />
  );
}
