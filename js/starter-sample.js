"use strict";

const STARTER_SAMPLE = "println(\"\\x1b[1;32mHello from the JS terminal!\\x1b[0m\");\nconst name = await input(\"Your name: \");\nprintln(`Hi, \\x1b[36m${name || \"stranger\"}\\x1b[0m!\\n`);\n\nprintln(\"Press arrow keys. Esc quits.\");\nonKey((e) => {\n  if (e.actions.onPressed && e.key === \"Escape\") exit();\n  if (e.key.startsWith(\"Arrow\")) {\n    const s = e.actions.onPressed ? \"pressed \" : \"released\";\n    write(`\\r\\x1b[K${e.key} ${s}`);\n  }\n});\n";
