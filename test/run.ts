import { prisma } from "../src/lib/prisma";

async function main() {
  const suites: { name: string; run: () => Promise<void> }[] = [
    { name: "core", run: (await import("./core.test")).run },
    { name: "charging-compat", run: (await import("./charging.test")).run },
    { name: "security", run: (await import("./security.test")).run },
    { name: "phase2", run: (await import("./phase2.test")).run },
  ];
  let failed = 0;
  for (const s of suites) {
    try {
      await s.run();
      console.log(`SUITE PASS: ${s.name}`);
    } catch (e) {
      failed++;
      console.error(`SUITE FAIL: ${s.name}:`, e);
    }
  }
  await prisma.$disconnect();
  if (failed > 0) { console.error(`${failed} suite(s) FAILED`); process.exit(1); }
  console.log("ALL TESTS PASS");
}
main();
