'use strict';
const fs=require('node:fs');
function readEnvironment(file){
  if(!fs.existsSync(file))throw Error('Falta .env: copia .env.example a .env');
  const vars={...process.env};
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const match=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if(!match)continue;
    let val=match[2];if((val.startsWith('"')&&val.endsWith('"'))||(val.startsWith("'")&&val.endsWith("'")))val=val.slice(1,-1);
    if(!Object.hasOwn(process.env,match[1]))vars[match[1]]=val;
  }
  return vars;
}
module.exports={readEnvironment};
