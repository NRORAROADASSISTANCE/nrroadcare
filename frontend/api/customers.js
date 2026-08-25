import handler from "./[...path].js";

export default async function customersHandler(req, res) {
  const id = req.query?.id;
  req.query = {
    ...(req.query || {}),
    path: id ? ["customers", String(id)] : ["customers"]
  };
  return handler(req, res);
}
