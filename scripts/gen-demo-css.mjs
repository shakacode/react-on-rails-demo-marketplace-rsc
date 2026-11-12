import { writeFileSync } from 'node:fs';
const [, , outFile, prefix, kb, outline] = process.argv;
const targetBytes = (Number(kb) || 300) * 1024;
// Sentinel string survives css-loader hashing + minification (it's a content value) -> greppable in
// downloaded assets. Marker class has a unique outline-width for getComputedStyle assertions.
let css =
  `/* ${prefix} ~${kb}KB */\n` +
  `.${prefix}_sentinel::after { content: "SENTINEL_${prefix.toUpperCase()}"; }\n` +
  `.${prefix}_marker { outline-style: solid; outline-width: ${outline}px; outline-color: hsl(${(outline * 17) % 360},80%,40%); }\n`;
let i = 0;
while (css.length < targetBytes) {
  const h = (i * 37) % 360, s = (i * 13) % 100, l = 30 + (i * 7) % 50;
  css +=
    `.${prefix}_box${i} {\n` +
    `  --${prefix}-v-${i}: ${(i * 7919) % 1000000};\n` +
    `  color: hsl(${h}, ${s}%, ${l}%);\n` +
    `  background-color: hsl(${(h + 180) % 360}, ${s}%, ${100 - l}%);\n` +
    `  border: ${1 + (i % 5)}px solid hsl(${(h + 90) % 360}, 50%, 50%);\n` +
    `  margin: ${i % 20}px ${(i * 3) % 30}px ${(i * 5) % 25}px ${(i * 7) % 18}px;\n` +
    `  padding: ${i % 15}px ${(i * 2) % 22}px;\n` +
    `  border-radius: ${i % 12}px ${(i * 2) % 9}px;\n` +
    `  box-shadow: ${i % 5}px ${i % 7}px ${i % 9}px rgba(${i % 255}, ${(i * 2) % 255}, ${(i * 3) % 255}, 0.${(i % 9) + 1});\n` +
    `  transform: rotate(${i % 360}deg) scale(1.${(i % 50).toString().padStart(2, '0')});\n` +
    `  font-size: ${10 + (i % 20)}px;\n` +
    `  line-height: 1.${i % 9};\n` +
    `  letter-spacing: 0.${i % 9}px;\n` +
    `  opacity: 0.${(i % 9) + 1};\n` +
    `}\n`;
  i++;
}
writeFileSync(outFile, css);
console.log(`${outFile}: ${(css.length / 1024).toFixed(0)}KB raw, ${i + 2} rules`);
