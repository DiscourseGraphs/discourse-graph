"use client";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ProcessingStep = () => {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 p-6">
      {/* Spinner */}
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      <div className="text-center">
        <p className="text-lg font-medium text-neutral-dark">
          Extracting discourse nodes...
        </p>
        <p className="mt-1 text-sm text-gray-500">
          This may take up to a minute depending on paper length.
        </p>
      </div>
    </div>
  );
};
