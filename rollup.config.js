import typescript from "rollup-plugin-typescript2";
import { uglify } from "rollup-plugin-uglify";

const plugins = [
    typescript({
        typescript: require("typescript")
    }),
    uglify({
        compress: {
            passes: 3
        },
        toplevel: false
    })
];

export default [{
    input: "src/chart.ts",
    output: {
        name: 'Chart',
        file: "dist/chart.js",
        format: "iife"
    },
    plugins 
}, {
    input: "src/data.json.js",
    output: {
        name: '_data_',
        file: "dist/data.json.js",
        format: "iife"
    }
}];
