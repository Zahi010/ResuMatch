"use client";

import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(
  async () => {
    const { default: RQ, Quill } = await import("react-quill-new");
    // Switch to inline styles instead of classes for size and font
    // This allows the backend to easily parse the exact point sizes
    const SizeStyle = Quill.import("attributors/style/size");
    SizeStyle.whitelist = ["8pt", "10pt", "11pt", "12pt", "14pt", "18pt", "24pt"];
    Quill.register(SizeStyle, true);
    return RQ;
  },
  { ssr: false }
);

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const modules = {
  toolbar: [
    [{ 'size': ["8pt", "10pt", "11pt", "12pt", "14pt", "18pt", "24pt", false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    ['clean']
  ],
};

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  return (
    <div className="bg-white rounded text-black overflow-hidden border border-zinc-700">
      <ReactQuill 
        theme="snow" 
        value={value} 
        onChange={onChange} 
        modules={modules}
        placeholder={placeholder}
        className="h-32 mb-10" // quill needs space for its toolbar and content
      />
    </div>
  );
}
