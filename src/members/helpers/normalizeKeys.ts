function normalizeKeys<T extends Record<string, any>>(
  objA: T,
  objB: T,
): [T, T] {
  const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
  const resultA: Record<string, any> = { ...objA };
  const resultB: Record<string, any> = { ...objB };

  for (const key of allKeys) {
    if (!(key in resultA)) {
      resultA[key] = '';
    }
    if (!(key in resultB)) {
      resultB[key] = '';
    }
  }

  return [resultA as T, resultB as T];
}

export { normalizeKeys };
