import handler from "./[...path].js";
export default async function(req,res){
  req.query = req.query || {};
  req.query.path = ["create-order"];
  return handler(req,res);
}
