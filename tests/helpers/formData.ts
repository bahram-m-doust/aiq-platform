type TestFormDataValue = Blob | boolean | number | string | null | undefined;

export function formData(values: Record<string, TestFormDataValue>) {
  const data = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === "boolean") {
      if (value) {
        data.set(key, "true");
      }

      return;
    }

    data.set(key, value instanceof Blob ? value : String(value));
  });

  return data;
}
