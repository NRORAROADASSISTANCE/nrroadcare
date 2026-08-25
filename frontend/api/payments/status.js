import handler from "./[...path].js";
export default async function(req,res){
  req.query = req.query || {};
  req.query.path = ["status"];
  return handler(req,res);
}
