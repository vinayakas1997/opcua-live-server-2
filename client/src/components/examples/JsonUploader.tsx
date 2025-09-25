import JsonUploader from "../JsonUploader";

export default function JsonUploaderExample() {
  return (
    <div className="p-4 max-w-4xl">
      <JsonUploader
        onConfigUploaded={(config) => {
          console.log('Config uploaded:', config);
        }}
        onClose={() => console.log('Uploader closed')}
      />
    </div>
  );
}