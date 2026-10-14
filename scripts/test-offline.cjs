/* Test runner for disconnected QA. Uses global TypeScript only to transpile pure domain tests. */
const fs=require('fs'),path=require('path'),ts=(()=>{try{return require('typescript')}catch{return require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}})();
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(mod,name)=>{
 const content=fs.readFileSync(name,'utf8');
 const compiled=ts.transpileModule(content,{fileName:name,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 mod._compile(compiled,name)
};
const files=fs.readdirSync(path.join(__dirname,'../tests')).filter(name=>name.endsWith('.test.ts')).sort();
for(const name of files){ if(process.env.F1_TEST_FILTER && !name.includes(process.env.F1_TEST_FILTER)) continue; console.error('LOAD_TEST',name);require(path.join(__dirname,'../tests',name));}
