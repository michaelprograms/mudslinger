let fs = require("fs-extra");

// To be run from package root, paths accordingly
fs.copySync("node_modules/codemirror/addon", "static/public/codemirror/addon");
fs.copySync("node_modules/codemirror/keymap", "static/public/codemirror/keymap");
fs.copySync("node_modules/codemirror/lib", "static/public/codemirror/lib");
fs.copySync("node_modules/codemirror/mode", "static/public/codemirror/mode");
fs.copySync("node_modules/codemirror/theme", "static/public/codemirror/theme");

fs.copySync("node_modules/codemirror/LICENSE", 'static/public/codemirror/LICENSE');

let flConfig = "static/public/config.js";
let flConfigDefault = "static/public/config.default.js";
if (!fs.existsSync(flConfig)) {
    fs.createReadStream(flConfigDefault).pipe(fs.createWriteStream(flConfig));
    console.log("Copying " + flConfigDefault + " to " + flConfig);
}
