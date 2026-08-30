import { useRef } from "react";

interface FilePickerProps {
  onFilesSelected: (files: FileList) => void;
  multiple?: boolean;
  disabled?: boolean;
}

export function FilePicker({ onFilesSelected, multiple = true, disabled }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFilesSelected(e.target.files);
            e.target.value = "";
          }
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-600 bg-slate-900/50 px-6 py-10 transition hover:border-sky-500 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          className="h-10 w-10 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <div className="text-center">
          <p className="font-medium text-white">Choose files</p>
          <p className="mt-1 text-sm text-slate-400">or drop them here</p>
        </div>
      </button>
    </div>
  );
}
