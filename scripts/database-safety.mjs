export function approvedPrototypeDatabase(value, allowedName) {
  const url = new URL(value);
  const database = url.pathname.slice(1);
  return (
    ['localhost', '127.0.0.1', 'postgres'].includes(url.hostname) &&
    ['tms_development', 'tms_test', 'cpsync'].includes(allowedName) &&
    database === allowedName &&
    !/prod|production/i.test(database)
  );
}
