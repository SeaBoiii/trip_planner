import React from 'react';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function TextArea({ label, className = '', id, ...props }: TextAreaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors
          focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
          dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 ${className}`}
        rows={3}
        {...props}
      />
    </div>
  );
}
